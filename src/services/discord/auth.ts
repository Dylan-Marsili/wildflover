/**
 * File: auth.ts
 * Author: Wildflover
 * Description: Discord OAuth2 authentication service with guild verification
 *              - Token exchange handled by Rust backend for security
 *              - Network retry mechanism for API calls
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';
import { DISCORD_CONFIG, generateState, generateAuthUrl } from './config';
import { NetworkService } from './network';
import { authStorage, RATE_LIMIT_CONFIG, type VerificationCache } from './storage';
import { GuildVerificationService } from './guild';
import { discordEvents } from './events';
import type { 
  DiscordUser, 
  DiscordGuild, 
  DiscordTokenResponse, 
  AuthState,
  GuildVerificationResult 
} from '../../types/discord';

// [INTERFACE] Rust backend token result
interface RustTokenResult {
  success: boolean;
  data: DiscordTokenResponse | null;
  error: string | null;
}

// [CLASS] Discord authentication service
class DiscordAuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private user: DiscordUser | null = null;
  private rateLimitUntil: number = 0;
  private retryCount: number = 0;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private networkService: NetworkService;
  private guildService: GuildVerificationService;

  constructor() {
    this.networkService = new NetworkService((retryAfter) => this.setRateLimit(retryAfter));
    this.guildService = new GuildVerificationService(
      this.networkService,
      () => this.accessToken,
      () => this.refreshAccessToken()
    );
    this.loadStoredAuth();
    this.loadRateLimitState();
  }

  // [METHOD] Load rate limit state from storage
  private loadRateLimitState(): void {
    const state = authStorage.loadRateLimitState();
    this.rateLimitUntil = state.rateLimitUntil;
    this.retryCount = state.retryCount;
  }

  // [METHOD] Check if currently rate limited
  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitUntil;
  }

  // [METHOD] Get remaining rate limit time in seconds
  public getRateLimitRemaining(): number {
    const remaining = this.rateLimitUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  // [METHOD] Set rate limit with exponential backoff
  private setRateLimit(retryAfter?: number): void {
    this.retryCount++;
    const baseDelay = retryAfter 
      ? retryAfter * 1000 
      : RATE_LIMIT_CONFIG.BASE_DELAY_MS * Math.pow(2, this.retryCount - 1);
    
    const delay = Math.min(baseDelay, RATE_LIMIT_CONFIG.MAX_DELAY_MS);
    this.rateLimitUntil = Date.now() + delay;
    
    authStorage.saveRateLimitState(this.rateLimitUntil, this.retryCount);
    console.log('[DISCORD-AUTH] Rate limit set:', { delayMs: delay, retryCount: this.retryCount });
    
    // [EVENT] Emit rate limit event for toast notification
    const seconds = Math.ceil(delay / 1000);
    discordEvents.emitRateLimit(seconds, 'Discord API rate limited');
  }

  // [METHOD] Clear rate limit state
  private clearRateLimit(): void {
    this.rateLimitUntil = 0;
    this.retryCount = 0;
    authStorage.clearRateLimitState();
    console.log('[DISCORD-AUTH] Rate limit cleared');
  }

  // [METHOD] Load stored authentication data
  private loadStoredAuth(): void {
    const data = authStorage.loadAuth();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.tokenExpiry = data.tokenExpiry;
    this.user = data.user;
    console.log('[DISCORD-AUTH] Stored auth loaded');
  }

  // [METHOD] Save authentication data to storage
  private saveAuth(tokens: DiscordTokenResponse, user: DiscordUser): void {
    const data = authStorage.saveAuth(tokens, user);
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.tokenExpiry = data.tokenExpiry;
    this.user = data.user;
  }

  // [METHOD] Clear all authentication data
  public clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.user = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    authStorage.clearAuth();
    // NOTE: Do NOT clear verification cache here - it should persist for rate limit fallback
    // Verification cache is only cleared on explicit logout or denied access
    this.clearRateLimit();
    console.log('[DISCORD-AUTH] Auth data cleared (verification cache preserved)');
  }

  // [METHOD] Clear all data including verification cache (for logout/denied)
  public clearAllData(): void {
    this.clearAuth();
    authStorage.clearVerificationCache();
    authStorage.clearGuildRateLimit();
    console.log('[DISCORD-AUTH] All data cleared including verification cache');
  }

  // [METHOD] Check if user is authenticated (has valid tokens)
  public isAuthenticated(): boolean {
    // Must have refresh token at minimum
    const hasAuth = !!(this.refreshToken && (this.accessToken || this.user));
    console.log('[DISCORD-AUTH] isAuthenticated check:', {
      hasRefreshToken: !!this.refreshToken,
      hasAccessToken: !!this.accessToken,
      hasUser: !!this.user,
      result: hasAuth
    });
    return hasAuth;
  }

  // [METHOD] Check if token is still valid without making API call
  public isTokenValid(): boolean {
    // Must have access token
    if (!this.accessToken) {
      return false;
    }
    
    // Check expiry with 5 minute buffer
    if (this.tokenExpiry && Date.now() < (this.tokenExpiry - 300000)) {
      return true;
    }
    
    return false;
  }

  // [METHOD] Ensure valid access token - refresh if needed
  public async ensureValidToken(): Promise<boolean> {
    // No tokens at all
    if (!this.refreshToken) {
      console.log('[DISCORD-AUTH] No refresh token available');
      return false;
    }

    // Token still valid (with 5 minute buffer) - NO API CALL NEEDED
    if (this.isTokenValid()) {
      console.log('[DISCORD-AUTH] Token still valid, skipping refresh');
      return true;
    }

    // Check rate limit before attempting refresh
    if (this.isRateLimited()) {
      console.log('[DISCORD-AUTH] Rate limited, cannot refresh token');
      // Return true if we have cached user data - allow offline mode
      return !!this.user;
    }

    // Token expired or missing - try to refresh
    console.log('[DISCORD-AUTH] Token expired or missing, refreshing...');
    
    try {
      const result = await this.refreshAccessToken();
      console.log('[DISCORD-AUTH] Token refresh result:', result);
      return result;
    } catch (error) {
      console.error('[DISCORD-AUTH] Token refresh threw error:', error);
      return false;
    }
  }

  // [METHOD] Get current user
  public getUser(): DiscordUser | null {
    return this.user;
  }

  // [METHOD] Get access token
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  // [METHOD] Initiate OAuth2 login flow
  public initiateLogin(): { url: string; state: string } {
    const state = generateState();
    authStorage.saveAuthState(state);
    
    const url = generateAuthUrl(state);
    console.log('[DISCORD-AUTH] Login initiated');
    
    return { url, state };
  }

  // [METHOD] Handle OAuth2 callback
  public async handleCallback(code: string, state: string): Promise<AuthState> {
    try {
      // Verify state to prevent CSRF
      const storedState = authStorage.getAndClearAuthState();
      if (state !== storedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      const tokens = await this.exchangeCode(code);
      const user = await this.fetchUser(tokens.access_token);
      this.saveAuth(tokens, user);

      return {
        isAuthenticated: true,
        isLoading: false,
        user,
        accessToken: tokens.access_token,
        error: null,
        hasGuildAccess: false,
      };
    } catch (error) {
      console.error('[DISCORD-AUTH] Callback handling failed:', error);
      return {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        error: error instanceof Error ? error.message : 'Authentication failed',
        hasGuildAccess: false,
      };
    }
  }

  // [METHOD] Exchange authorization code for tokens via Rust backend
  private async exchangeCode(code: string): Promise<DiscordTokenResponse> {
    // Check rate limit before making request
    if (this.isRateLimited()) {
      const remaining = this.getRateLimitRemaining();
      throw new Error(`Please wait ${remaining} seconds before trying again.`);
    }

    try {
      // Call Rust backend for secure token exchange (client_secret is in Rust)
      // Pass redirect_uri to support both dev (localhost) and production (tauri.localhost)
      const result = await invoke<RustTokenResult>('discord_exchange_code', { 
        code,
        redirectUri: DISCORD_CONFIG.REDIRECT_URI
      });
      
      if (result.success && result.data) {
        // Success - clear any rate limit state
        this.clearRateLimit();
        return result.data;
      } else {
        // Parse and convert to user-friendly error
        const userError = this.parseApiError(result.error);
        
        // Check if rate limited
        if (result.error?.includes('rate limit') || result.error?.includes('Rate limited')) {
          this.setRateLimit(60);
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        
        throw new Error(userError);
      }
    } catch (error) {
      console.error('[DISCORD-AUTH] Token exchange error:', error);
      // Re-throw with user-friendly message if not already formatted
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Connection failed. Please check your internet and try again.');
    }
  }

  // [METHOD] Parse API error to user-friendly message
  private parseApiError(error: string | null | undefined): string {
    if (!error) return 'Authentication failed. Please try again.';
    
    const errorLower = error.toLowerCase();
    
    // Rate limit errors
    if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    // Timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'Connection timeout. Please check your internet and try again.';
    }
    
    // Connection errors
    if (errorLower.includes('could not connect') || errorLower.includes('connection')) {
      return 'Could not connect to Discord. Please check your internet connection.';
    }
    
    // Invalid request errors
    if (errorLower.includes('invalid_request') || errorLower.includes('invalid request')) {
      return 'Session expired. Please try logging in again.';
    }
    
    // Invalid grant errors
    if (errorLower.includes('invalid_grant') || errorLower.includes('invalid grant') || errorLower.includes('session expired')) {
      return 'Login session expired. Please try again.';
    }
    
    // Network errors
    if (errorLower.includes('network') || errorLower.includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    
    // Token errors
    if (errorLower.includes('token') && errorLower.includes('invalid')) {
      return 'Session expired. Please log in again.';
    }
    
    // If error is already user-friendly (from Rust backend), return as-is
    if (!errorLower.includes('error:') && !errorLower.includes('failed:') && error.length < 100) {
      return error;
    }
    
    // Generic fallback - don't show technical details
    return 'Something went wrong. Please try again.';
  }

  // [METHOD] Refresh access token with rate limit protection
  public async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.log('[DISCORD-AUTH] No refresh token available');
      return false;
    }

    // Check if already refreshing (prevent duplicate requests)
    if (this.isRefreshing && this.refreshPromise) {
      console.log('[DISCORD-AUTH] Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    // Check rate limit
    if (this.isRateLimited()) {
      const remaining = this.getRateLimitRemaining();
      console.log(`[DISCORD-AUTH] Rate limited, ${remaining}s remaining`);
      
      // If max retries exceeded, clear auth
      if (this.retryCount >= RATE_LIMIT_CONFIG.MAX_RETRIES) {
        console.log('[DISCORD-AUTH] Max retries exceeded, clearing auth');
        this.clearAuth();
        return false;
      }
      
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefreshToken();
    
    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  // [METHOD] Internal token refresh implementation via Rust backend
  private async doRefreshToken(): Promise<boolean> {
    try {
      const result = await invoke<RustTokenResult>('discord_refresh_token', { 
        refreshToken: this.refreshToken! 
      });

      if (result.success && result.data) {
        const tokens = result.data;
        
        // Update stored tokens via storage service
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        this.tokenExpiry = authStorage.updateTokens(
          tokens.access_token, 
          tokens.refresh_token, 
          tokens.expires_in
        );

        this.clearRateLimit();
        console.log('[DISCORD-AUTH] Token refreshed successfully');
        return true;
      } else {
        console.error('[DISCORD-AUTH] Token refresh failed:', result.error);
        
        if (result.error?.includes('Rate limited')) {
          this.setRateLimit(30);
          return false;
        }
        
        if (result.error?.includes('Invalid refresh token')) {
          console.log('[DISCORD-AUTH] Refresh token revoked, clearing auth');
          this.clearAuth();
        }
        
        return false;
      }
    } catch (error) {
      console.error('[DISCORD-AUTH] Token refresh network error:', error);
      this.setRateLimit();
      return false;
    }
  }

  // [METHOD] Fetch user data from Discord API with retry support
  private async fetchUser(accessToken: string): Promise<DiscordUser> {
    console.log('[DISCORD-AUTH] Fetching user data...');
    
    const { response, data } = await this.networkService.fetchWithRetry<DiscordUser>(
      DISCORD_CONFIG.API.USER,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Handle auth error - caller should handle token refresh
    if (response.status === 401) {
      throw new Error('Token expired or invalid');
    }

    if (!data) {
      throw new Error('Failed to parse user data');
    }

    console.log('[DISCORD-AUTH] User data fetched successfully');
    return data;
  }

  // [METHOD] Refresh user data from Discord API with retry support
  public async refreshUserData(): Promise<DiscordUser | null> {
    if (!this.accessToken) {
      console.log('[DISCORD-AUTH] No access token for user data refresh');
      return this.user;
    }

    console.log('[DISCORD-AUTH] Refreshing user data...');

    try {
      const user = await this.fetchUser(this.accessToken);
      this.user = user;
      authStorage.updateUser(user);
      console.log('[DISCORD-AUTH] User data refreshed successfully');
      return user;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DISCORD-AUTH] User data refresh failed:', errorMessage);
      
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        if (this.refreshToken) {
          console.log('[DISCORD-AUTH] Attempting token refresh for user data...');
          const refreshed = await this.refreshAccessToken();
          
          if (refreshed && this.accessToken) {
            try {
              const user = await this.fetchUser(this.accessToken);
              this.user = user;
              authStorage.updateUser(user);
              console.log('[DISCORD-AUTH] User data refreshed after token refresh');
              return user;
            } catch (retryError) {
              console.error('[DISCORD-AUTH] User data fetch failed after token refresh:', retryError);
            }
          }
        }
      }
      
      console.log('[DISCORD-AUTH] Returning cached user data');
      return this.user;
    }
  }

  // [METHOD] Fetch user's guilds - delegates to GuildVerificationService
  public async fetchUserGuilds(): Promise<DiscordGuild[]> {
    return this.guildService.fetchUserGuilds();
  }

  // [METHOD] Verify user is member of required guild - delegates to GuildVerificationService
  public async verifyGuildMembership(): Promise<GuildVerificationResult> {
    return this.guildService.verifyGuildMembership();
  }

  // [METHOD] Logout user via Rust backend
  public async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        // Revoke token via Rust backend (client_secret is in Rust)
        await invoke<RustTokenResult>('discord_revoke_token', { 
          token: this.accessToken 
        });
        console.log('[DISCORD-AUTH] Token revocation requested');
      } catch (error) {
        console.warn('[DISCORD-AUTH] Token revocation failed:', error);
      }
    }

    // Use clearAllData for logout - clears everything including verification cache
    this.clearAllData();
    console.log('[DISCORD-AUTH] User logged out');
  }

  // [METHOD] Get current auth state
  public getAuthState(): AuthState {
    return {
      isAuthenticated: this.isAuthenticated(),
      isLoading: false,
      user: this.user,
      accessToken: this.accessToken,
      error: null,
      hasGuildAccess: false,
    };
  }

  // [METHOD] Get verification cache
  public getVerificationCache(): VerificationCache | null {
    const userId = this.user?.id;
    return authStorage.loadVerificationCache(userId);
  }

  // [METHOD] Save verification cache
  public saveVerificationCache(verified: boolean, guildName: string | null): void {
    const userId = this.user?.id || '';
    authStorage.saveVerificationCache(verified, guildName, userId);
  }

  // [METHOD] Clear verification cache
  public clearVerificationCache(): void {
    authStorage.clearVerificationCache();
  }
}

// [EXPORT] Singleton instance
export const discordAuth = new DiscordAuthService();
export default discordAuth;

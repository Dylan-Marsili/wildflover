/**
 * File: storage.ts
 * Author: Wildflover
 * Description: Discord authentication storage management
 *              - Token persistence in localStorage
 *              - Rate limit state management
 *              - User data caching
 * Language: TypeScript
 */

import type { DiscordUser, DiscordTokenResponse } from '../../types/discord';

// [CONSTANTS] Storage keys for localStorage
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'discord_access_token',
  REFRESH_TOKEN: 'discord_refresh_token',
  TOKEN_EXPIRY: 'discord_token_expiry',
  USER_DATA: 'discord_user_data',
  AUTH_STATE: 'discord_auth_state',
  RATE_LIMIT_UNTIL: 'discord_rate_limit_until',
  RETRY_COUNT: 'discord_retry_count',
  VERIFICATION_CACHE: 'discord_verification_cache',
  GUILD_RATE_LIMIT: 'discord_guild_rate_limit',
} as const;

// [CONSTANTS] Rate limit configuration
export const RATE_LIMIT_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 5000,
  MAX_DELAY_MS: 60000,
  COOLDOWN_MS: 30000,
} as const;

// [CONSTANTS] Verification cache configuration
export const VERIFICATION_CACHE_CONFIG = {
  // Cache valid for 10 minutes - reduces API calls significantly
  CACHE_DURATION_MS: 10 * 60 * 1000,
  // Extended cache for rate limit situations - 1 hour
  RATE_LIMIT_CACHE_DURATION_MS: 60 * 60 * 1000,
} as const;

// [CONSTANTS] Guild rate limit configuration
export const GUILD_RATE_LIMIT_CONFIG = {
  // Minimum time between guild member API calls - 60 seconds
  MIN_INTERVAL_MS: 60 * 1000,
  // Rate limit cooldown - 5 minutes
  COOLDOWN_MS: 5 * 60 * 1000,
} as const;

// [INTERFACE] Stored authentication data
export interface StoredAuthData {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  user: DiscordUser | null;
}

// [INTERFACE] Rate limit state
export interface RateLimitState {
  rateLimitUntil: number;
  retryCount: number;
}

// [INTERFACE] Verification cache data
export interface VerificationCache {
  verified: boolean;
  guildName: string | null;
  timestamp: number;
  userId: string;
}

// [INTERFACE] Guild rate limit state
export interface GuildRateLimitState {
  lastCallTime: number;
  rateLimitedUntil: number;
}

// [CLASS] Authentication storage service
export class AuthStorageService {
  // [METHOD] Load stored authentication data
  public loadAuth(): StoredAuthData {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      console.log('[DISCORD-STORAGE] Auth data loaded');
      
      return {
        accessToken,
        refreshToken,
        tokenExpiry: expiry ? parseInt(expiry, 10) : null,
        user: userData ? JSON.parse(userData) : null,
      };
    } catch (error) {
      console.error('[DISCORD-STORAGE] Failed to load auth:', error);
      return { accessToken: null, refreshToken: null, tokenExpiry: null, user: null };
    }
  }

  // [METHOD] Save authentication tokens and user data
  public saveAuth(tokens: DiscordTokenResponse, user: DiscordUser): StoredAuthData {
    const tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, tokenExpiry.toString());
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    
    console.log('[DISCORD-STORAGE] Auth data saved');
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry,
      user,
    };
  }


  // [METHOD] Update tokens after refresh
  public updateTokens(accessToken: string, refreshToken: string, expiresIn: number): number {
    const tokenExpiry = Date.now() + (expiresIn * 1000);
    
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, tokenExpiry.toString());
    
    console.log('[DISCORD-STORAGE] Tokens updated');
    return tokenExpiry;
  }

  // [METHOD] Update user data
  public updateUser(user: DiscordUser): void {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    console.log('[DISCORD-STORAGE] User data updated');
  }

  // [METHOD] Clear all authentication data
  public clearAuth(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('[DISCORD-STORAGE] Auth data cleared');
  }

  // [METHOD] Save OAuth state for CSRF protection
  public saveAuthState(state: string): void {
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, state);
  }

  // [METHOD] Get and clear OAuth state
  public getAndClearAuthState(): string | null {
    const state = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
    return state;
  }

  // [METHOD] Load rate limit state
  public loadRateLimitState(): RateLimitState {
    try {
      const rateLimitUntil = localStorage.getItem(STORAGE_KEYS.RATE_LIMIT_UNTIL);
      const retryCount = localStorage.getItem(STORAGE_KEYS.RETRY_COUNT);
      
      let state: RateLimitState = {
        rateLimitUntil: rateLimitUntil ? parseInt(rateLimitUntil, 10) : 0,
        retryCount: retryCount ? parseInt(retryCount, 10) : 0,
      };
      
      // Reset retry count if cooldown has passed
      if (Date.now() > state.rateLimitUntil) {
        state.retryCount = 0;
        localStorage.removeItem(STORAGE_KEYS.RETRY_COUNT);
      }
      
      console.log('[DISCORD-STORAGE] Rate limit state loaded:', state);
      return state;
    } catch (error) {
      console.error('[DISCORD-STORAGE] Failed to load rate limit state:', error);
      return { rateLimitUntil: 0, retryCount: 0 };
    }
  }

  // [METHOD] Save rate limit state
  public saveRateLimitState(rateLimitUntil: number, retryCount: number): void {
    localStorage.setItem(STORAGE_KEYS.RATE_LIMIT_UNTIL, rateLimitUntil.toString());
    localStorage.setItem(STORAGE_KEYS.RETRY_COUNT, retryCount.toString());
    
    console.log('[DISCORD-STORAGE] Rate limit state saved:', {
      rateLimitUntil,
      retryCount,
      until: new Date(rateLimitUntil).toISOString()
    });
  }

  // [METHOD] Clear rate limit state
  public clearRateLimitState(): void {
    localStorage.removeItem(STORAGE_KEYS.RATE_LIMIT_UNTIL);
    localStorage.removeItem(STORAGE_KEYS.RETRY_COUNT);
    console.log('[DISCORD-STORAGE] Rate limit state cleared');
  }

  // [METHOD] Save verification cache (persistent localStorage)
  public saveVerificationCache(verified: boolean, guildName: string | null, userId: string): void {
    const cache: VerificationCache = {
      verified,
      guildName,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(STORAGE_KEYS.VERIFICATION_CACHE, JSON.stringify(cache));
    console.log('[DISCORD-STORAGE] Verification cache saved to localStorage');
  }

  // [METHOD] Load verification cache (persistent localStorage)
  public loadVerificationCache(userId?: string): VerificationCache | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.VERIFICATION_CACHE);
      if (!cached) {
        console.log('[DISCORD-STORAGE] No verification cache found');
        return null;
      }

      const cache: VerificationCache = JSON.parse(cached);
      
      // Validate user ID if provided (skip validation if no userId given)
      if (userId && cache.userId && cache.userId !== userId) {
        console.log('[DISCORD-STORAGE] Cache user mismatch, invalidating');
        this.clearVerificationCache();
        return null;
      }

      const age = Date.now() - cache.timestamp;
      const isRateLimited = this.isGuildRateLimited();
      
      // Use extended cache duration if rate limited
      const maxAge = isRateLimited 
        ? VERIFICATION_CACHE_CONFIG.RATE_LIMIT_CACHE_DURATION_MS 
        : VERIFICATION_CACHE_CONFIG.CACHE_DURATION_MS;

      if (age < maxAge) {
        const ageMinutes = Math.round(age / 60000);
        const maxMinutes = Math.round(maxAge / 60000);
        console.log(`[DISCORD-STORAGE] Verification cache valid: ${ageMinutes}/${maxMinutes} min`);
        return cache;
      }

      console.log('[DISCORD-STORAGE] Verification cache expired');
      return null;
    } catch (error) {
      console.error('[DISCORD-STORAGE] Failed to load verification cache:', error);
      return null;
    }
  }

  // [METHOD] Clear verification cache
  public clearVerificationCache(): void {
    localStorage.removeItem(STORAGE_KEYS.VERIFICATION_CACHE);
    console.log('[DISCORD-STORAGE] Verification cache cleared');
  }

  // [METHOD] Set guild API rate limit
  public setGuildRateLimit(): void {
    const state: GuildRateLimitState = {
      lastCallTime: Date.now(),
      rateLimitedUntil: Date.now() + GUILD_RATE_LIMIT_CONFIG.COOLDOWN_MS,
    };
    localStorage.setItem(STORAGE_KEYS.GUILD_RATE_LIMIT, JSON.stringify(state));
    console.log('[DISCORD-STORAGE] Guild rate limit set for 5 minutes');
  }

  // [METHOD] Check if guild API is rate limited
  public isGuildRateLimited(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.GUILD_RATE_LIMIT);
      if (!cached) return false;

      const state: GuildRateLimitState = JSON.parse(cached);
      return Date.now() < state.rateLimitedUntil;
    } catch {
      return false;
    }
  }

  // [METHOD] Get guild rate limit remaining time in seconds
  public getGuildRateLimitRemaining(): number {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.GUILD_RATE_LIMIT);
      if (!cached) return 0;

      const state: GuildRateLimitState = JSON.parse(cached);
      const remaining = state.rateLimitedUntil - Date.now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    } catch {
      return 0;
    }
  }

  // [METHOD] Check if enough time passed since last guild API call
  public canCallGuildApi(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.GUILD_RATE_LIMIT);
      if (!cached) return true;

      const state: GuildRateLimitState = JSON.parse(cached);
      
      // Check if rate limited
      if (Date.now() < state.rateLimitedUntil) {
        return false;
      }
      
      // Check minimum interval
      const timeSinceLastCall = Date.now() - state.lastCallTime;
      return timeSinceLastCall >= GUILD_RATE_LIMIT_CONFIG.MIN_INTERVAL_MS;
    } catch {
      return true;
    }
  }

  // [METHOD] Record guild API call time
  public recordGuildApiCall(): void {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.GUILD_RATE_LIMIT);
      let state: GuildRateLimitState;
      
      if (cached) {
        state = JSON.parse(cached);
        state.lastCallTime = Date.now();
      } else {
        state = {
          lastCallTime: Date.now(),
          rateLimitedUntil: 0,
        };
      }
      
      localStorage.setItem(STORAGE_KEYS.GUILD_RATE_LIMIT, JSON.stringify(state));
    } catch {
      // Ignore errors
    }
  }

  // [METHOD] Clear guild rate limit
  public clearGuildRateLimit(): void {
    localStorage.removeItem(STORAGE_KEYS.GUILD_RATE_LIMIT);
    console.log('[DISCORD-STORAGE] Guild rate limit cleared');
  }
}

// [EXPORT] Singleton instance
export const authStorage = new AuthStorageService();

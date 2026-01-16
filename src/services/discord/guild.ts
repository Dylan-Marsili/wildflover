/**
 * File: guild.ts
 * Author: Wildflover
 * Description: Discord guild and role verification service
 *              - Guild membership verification with rate limit protection
 *              - Role-based access control with caching
 *              - Smart API call throttling
 * Language: TypeScript
 */

import { DISCORD_CONFIG } from './config';
import { NetworkService } from './network';
import { authStorage } from './storage';
import type { DiscordGuild, GuildVerificationResult } from '../../types/discord';

// [INTERFACE] Guild member response from Discord API
interface GuildMemberResponse {
  roles?: string[];
}

// [CLASS] Guild verification service
export class GuildVerificationService {
  private networkService: NetworkService;
  private getAccessToken: () => string | null;
  private refreshToken: () => Promise<boolean>;

  constructor(
    networkService: NetworkService,
    getAccessToken: () => string | null,
    refreshToken: () => Promise<boolean>
  ) {
    this.networkService = networkService;
    this.getAccessToken = getAccessToken;
    this.refreshToken = refreshToken;
  }

  // [METHOD] Fetch user's guilds with retry and token refresh support
  public async fetchUserGuilds(): Promise<DiscordGuild[]> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    console.log('[DISCORD-GUILD] Fetching user guilds...');

    try {
      const { response, data } = await this.networkService.fetchWithRetry<DiscordGuild[]>(
        DISCORD_CONFIG.API.GUILDS,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (response.status === 401) {
        console.log('[DISCORD-GUILD] Token expired, refreshing...');
        const refreshed = await this.refreshToken();
        
        if (!refreshed) throw new Error('Token refresh failed');

        const newToken = this.getAccessToken();
        const retryResult = await this.networkService.fetchWithRetry<DiscordGuild[]>(
          DISCORD_CONFIG.API.GUILDS,
          { headers: { Authorization: `Bearer ${newToken}` } }
        );

        if (!retryResult.data) throw new Error('Failed to fetch guilds after token refresh');
        
        console.log('[DISCORD-GUILD] Guilds fetched after token refresh');
        return retryResult.data;
      }

      if (!data) throw new Error('Failed to parse guilds data');

      console.log(`[DISCORD-GUILD] Fetched ${data.length} guilds successfully`);
      return data;

    } catch (error) {
      console.error('[DISCORD-GUILD] Guild fetch failed:', error);
      throw error;
    }
  }


  // [METHOD] Verify user has required role with rate limit protection
  private async verifyUserRole(): Promise<boolean> {
    const accessToken = this.getAccessToken();
    if (!accessToken || !DISCORD_CONFIG.REQUIRED_ROLE_ID) {
      return true;
    }

    // [RATE-LIMIT-CHECK] Check if we can make API call
    if (!authStorage.canCallGuildApi()) {
      const remaining = authStorage.getGuildRateLimitRemaining();
      console.log(`[DISCORD-GUILD] API throttled, ${remaining}s remaining`);
      throw new Error('THROTTLED');
    }

    console.log('[DISCORD-GUILD] Verifying user role...');

    const url = DISCORD_CONFIG.API.GUILD_MEMBER
      .replace('{guild_id}', DISCORD_CONFIG.REQUIRED_GUILD_ID);

    try {
      const currentToken = this.getAccessToken();
      if (!currentToken) {
        console.error('[DISCORD-GUILD] No access token available');
        return false;
      }

      // Record API call time before making request
      authStorage.recordGuildApiCall();
      
      console.log('[DISCORD-GUILD] Checking role...');
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      console.log(`[DISCORD-GUILD] Response status: ${response.status}`);

      // [SUCCESS] Parse and check roles
      if (response.ok) {
        const data = await response.json() as GuildMemberResponse;
        const hasRole = data.roles?.includes(DISCORD_CONFIG.REQUIRED_ROLE_ID) ?? false;
        
        console.log('[DISCORD-GUILD] Role verification result:', {
          userRoles: data.roles?.length || 0,
          requiredRole: DISCORD_CONFIG.REQUIRED_ROLE_ID,
          hasRole
        });
        
        return hasRole;
      }

      // [401] Token expired - try refresh once
      if (response.status === 401) {
        console.log('[DISCORD-GUILD] Token expired, refreshing...');
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          console.error('[DISCORD-GUILD] Token refresh failed');
          return false;
        }
        
        const newToken = this.getAccessToken();
        const retryResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        
        if (retryResponse.ok) {
          const data = await retryResponse.json() as GuildMemberResponse;
          return data.roles?.includes(DISCORD_CONFIG.REQUIRED_ROLE_ID) ?? false;
        }
        
        return false;
      }

      // [429] Rate limited - set cooldown and throw
      if (response.status === 429) {
        console.error('[DISCORD-GUILD] Rate limited by Discord API');
        authStorage.setGuildRateLimit();
        throw new Error('RATE_LIMITED');
      }

      const errorText = await response.text().catch(() => '');
      console.error(`[DISCORD-GUILD] API error ${response.status}: ${errorText}`);
      return false;

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'RATE_LIMITED' || error.message === 'THROTTLED') {
          throw error;
        }
      }
      console.error('[DISCORD-GUILD] Network error:', error);
      return false;
    }
  }

  // [METHOD] Verify user is member of required guild with role check
  public async verifyGuildMembership(): Promise<GuildVerificationResult> {
    try {
      const guilds = await this.fetchUserGuilds();
      const requiredGuild = guilds.find(
        guild => guild.id === DISCORD_CONFIG.REQUIRED_GUILD_ID
      );

      if (!requiredGuild) {
        console.log('[DISCORD-GUILD] User is not a member of required guild');
        return {
          success: false,
          error: 'You must be a member of the required Discord server to use this application.',
        };
      }

      if (DISCORD_CONFIG.REQUIRED_ROLE_ID) {
        try {
          const hasRole = await this.verifyUserRole();
          if (!hasRole) {
            console.log('[DISCORD-GUILD] User does not have required role');
            return {
              success: false,
              error: 'You don\'t have access permission.',
            };
          }
          console.log('[DISCORD-GUILD] Role verification passed');
        } catch (roleError) {
          if (roleError instanceof Error) {
            // [RATE-LIMIT] Return specific error for rate limit
            if (roleError.message === 'RATE_LIMITED') {
              console.log('[DISCORD-GUILD] Rate limited during role check');
              authStorage.setGuildRateLimit();
              return {
                success: false,
                error: 'RATE_LIMITED',
              };
            }
            // [THROTTLED] API call throttled - use cache
            if (roleError.message === 'THROTTLED') {
              console.log('[DISCORD-GUILD] API throttled, checking cache...');
              return {
                success: false,
                error: 'THROTTLED',
              };
            }
          }
          throw roleError;
        }
      }

      console.log('[DISCORD-GUILD] Guild membership verified:', requiredGuild.name);
      return {
        success: true,
        guildName: requiredGuild.name,
      };
    } catch (error) {
      console.error('[DISCORD-GUILD] Guild verification failed:', error);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('RATE_LIMITED') || errorMsg.includes('429')) {
        return {
          success: false,
          error: 'RATE_LIMITED',
        };
      }
      
      return {
        success: false,
        error: 'Verification failed. Please try again.',
      };
    }
  }
}

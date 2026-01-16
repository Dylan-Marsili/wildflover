/**
 * File: index.ts
 * Author: Wildflover
 * Description: Discord services barrel export
 *              - Centralized exports for Discord authentication modules
 * Language: TypeScript
 */

// [EXPORT] Main authentication service
export { discordAuth, default } from './auth';

// [EXPORT] Configuration and utilities
export { 
  DISCORD_CONFIG, 
  generateAuthUrl, 
  generateState, 
  getAvatarUrl, 
  getGuildIconUrl 
} from './config';

// [EXPORT] Network service for API calls
export { NetworkService, NETWORK_CONFIG } from './network';
export type { NetworkErrorType, FetchResult } from './network';

// [EXPORT] Storage service for persistence
export { authStorage, STORAGE_KEYS, RATE_LIMIT_CONFIG } from './storage';
export type { StoredAuthData, RateLimitState } from './storage';

// [EXPORT] Guild verification service
export { GuildVerificationService } from './guild';

// [EXPORT] Discord Rich Presence service
export { discordRpc } from './rpc';
export type { RpcPage } from './rpc';

// [EXPORT] Webhook notification service
export { webhookService } from './webhook';

// [EXPORT] Event emitter for notifications
export { discordEvents } from './events';
export type { DiscordEventType, RateLimitEvent, ErrorEvent } from './events';

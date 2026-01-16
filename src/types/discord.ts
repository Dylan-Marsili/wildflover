/**
 * File: discord.ts
 * Author: Wildflover
 * Description: Discord OAuth2 and API type definitions
 * Language: TypeScript
 */

// [INTERFACE] Discord user profile data
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  banner: string | null;
  accent_color: number | null;
  email?: string;
  verified?: boolean;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

// [INTERFACE] Discord guild (server) data
export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

// [INTERFACE] OAuth2 token response
export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// [INTERFACE] Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: DiscordUser | null;
  accessToken: string | null;
  error: string | null;
  hasGuildAccess: boolean;
}

// [INTERFACE] Guild verification result
export interface GuildVerificationResult {
  success: boolean;
  guildName?: string;
  error?: string;
}

// [TYPE] Authentication status
export type AuthStatus = 
  | 'idle'
  | 'authenticating'
  | 'verifying_guild'
  | 'success'
  | 'guild_not_found'
  | 'rate_limited'
  | 'error';

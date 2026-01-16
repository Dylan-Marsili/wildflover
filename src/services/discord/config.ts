/**
 * File: config.ts
 * Author: Wildflover
 * Description: Discord OAuth2 configuration and constants
 *              - Client secret moved to Rust backend for security
 *              - Environment variables for sensitive data
 * Language: TypeScript
 */

// [HELPER] Detect if running in development mode
const isDev = (): boolean => {
  return window.location.hostname === 'localhost' || window.location.port === '1420';
};

// [CONFIG] Discord OAuth2 application settings
// NOTE: Client secret is now handled by Rust backend (src-tauri/src/discord.rs)
// IMPORTANT: Replace these values with your own Discord Application credentials
export const DISCORD_CONFIG = {
  // Discord Application Client ID (from Discord Developer Portal)
  // Get yours at: https://discord.com/developers/applications
  CLIENT_ID: 'YOUR_DISCORD_CLIENT_ID',
  
  // OAuth2 Redirect URI (must match Discord Developer Portal settings)
  // Development: localhost:1420, Production: tauri://localhost
  // NOTE: Using root path to avoid routing issues in Tauri
  get REDIRECT_URI(): string {
    return isDev() 
      ? 'http://localhost:1420'
      : 'http://tauri.localhost';
  },
  
  // Required Guild ID for access verification
  // Users must be a member of this guild to use the application
  // Set to empty string '' to disable guild verification
  REQUIRED_GUILD_ID: 'YOUR_DISCORD_GUILD_ID',
  
  // Required Role ID for access verification (optional)
  // If set, users must have this role in the guild to access the application
  // Leave empty string '' to only check guild membership
  REQUIRED_ROLE_ID: '',
  
  // OAuth2 scopes required for authentication
  // guilds.members.read is needed for role verification
  SCOPES: ['identify', 'guilds', 'guilds.members.read'],
  
  // Discord API endpoints
  API: {
    BASE: 'https://discord.com/api/v10',
    AUTHORIZE: 'https://discord.com/api/oauth2/authorize',
    USER: 'https://discord.com/api/v10/users/@me',
    GUILDS: 'https://discord.com/api/v10/users/@me/guilds',
    GUILD_MEMBER: 'https://discord.com/api/v10/users/@me/guilds/{guild_id}/member',
  },
} as const;

// [FUNC] Generate OAuth2 authorization URL
export const generateAuthUrl = (state?: string): string => {
  const params = new URLSearchParams({
    client_id: DISCORD_CONFIG.CLIENT_ID,
    redirect_uri: DISCORD_CONFIG.REDIRECT_URI,
    response_type: 'code',
    scope: DISCORD_CONFIG.SCOPES.join(' '),
    prompt: 'consent', // Always show account selection
  });
  
  if (state) {
    params.append('state', state);
  }
  
  return `${DISCORD_CONFIG.API.AUTHORIZE}?${params.toString()}`;
};

// [FUNC] Generate random state for CSRF protection
export const generateState = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// [FUNC] Build Discord avatar URL with cache-busting
// NOTE: Timestamp parameter ensures fresh avatar on each session
//       Using session-based cache key for immediate refresh on app restart
export const getAvatarUrl = (userId: string, avatarHash: string | null, size: number = 128): string => {
  // [SESSION-CACHE] Generate unique session ID on first call - persists until app restart
  // This ensures fresh avatar on every app launch while avoiding unnecessary refetches during session
  if (!sessionCacheKey) {
    sessionCacheKey = Date.now().toString(36);
    console.log('[DISCORD-CONFIG] Session cache key generated:', sessionCacheKey);
  }
  
  if (!avatarHash) {
    // Default avatar based on user ID modulo
    const defaultIndex = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  }
  
  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=${size}&_=${sessionCacheKey}`;
};

// [SESSION] Unique cache key per app session - ensures fresh avatar on each app launch
let sessionCacheKey: string | null = null;

// [FUNC] Build Discord guild icon URL
export const getGuildIconUrl = (guildId: string, iconHash: string | null, size: number = 128): string => {
  if (!iconHash) {
    return '';
  }
  
  const extension = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${extension}?size=${size}`;
};

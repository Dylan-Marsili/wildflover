/**
 * File: marketplace.config.ts
 * Author: Wildflover
 * Description: Marketplace configuration with admin permissions and GitHub settings
 * Language: TypeScript
 */

// [TYPE] Admin entry structure
interface AdminEntry {
  discordId: string;
  name: string;
  role: string;
}

// [TYPE] Permissions structure from index.json
interface PermissionsConfig {
  admins: AdminEntry[];
  roles: Record<string, string[]>;
}

// [TYPE] Catalog structure
interface MarketplaceCatalogData {
  version: string;
  lastUpdated: string;
  totalMods: number;
  mods: unknown[];
  permissions?: PermissionsConfig;
}

// [STATE] Cached permissions from GitHub
let cachedPermissions: PermissionsConfig | null = null;

// [CONFIG] Marketplace system configuration
export const MARKETPLACE_CONFIG = {
  // [GITHUB] Repository settings for marketplace storage
  GITHUB_OWNER: 'wiildflover',
  GITHUB_REPO: 'wildflover-marketplace',
  GITHUB_BRANCH: 'main',

  // [CATALOG] Direct URL to fetch marketplace catalog
  get CATALOG_URL() {
    return `https://raw.githubusercontent.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/${this.GITHUB_BRANCH}/index.json`;
  },

  // [MODS] Base URL for mod files
  get MODS_BASE_URL() {
    return `https://raw.githubusercontent.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/${this.GITHUB_BRANCH}/mods`;
  },

  // [CACHE] Cache settings
  CACHE_TTL_MINUTES: 5,
  
  // [LIMITS] Upload limits
  MAX_FILE_SIZE_MB: 100,
  MAX_PREVIEW_SIZE_MB: 5,
  ALLOWED_EXTENSIONS: ['.fantome', '.zip'],
  ALLOWED_PREVIEW_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
};

// [FUNC] Fetch and cache permissions from GitHub index.json
export async function fetchPermissions(): Promise<PermissionsConfig | null> {
  if (cachedPermissions) return cachedPermissions;
  
  try {
    const response = await fetch(MARKETPLACE_CONFIG.CATALOG_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    
    const data = await response.json() as MarketplaceCatalogData;
    if (data.permissions) {
      cachedPermissions = data.permissions;
      console.log('[MARKETPLACE-CONFIG] Permissions loaded from GitHub');
    }
    return cachedPermissions;
  } catch (error) {
    console.error('[MARKETPLACE-CONFIG] Failed to fetch permissions:', error);
    return null;
  }
}

// [FUNC] Update cached permissions (called by marketplaceService)
export function updateCachedPermissions(permissions: PermissionsConfig): void {
  cachedPermissions = permissions;
}

// [FUNC] Check if a Discord user ID has admin permissions
export function isMarketplaceAdmin(discordUserId: string): boolean {
  if (!cachedPermissions) return false;
  return cachedPermissions.admins.some(admin => admin.discordId === discordUserId);
}

// [FUNC] Get admin info by Discord ID
export function getAdminInfo(discordUserId: string): AdminEntry | null {
  if (!cachedPermissions) return null;
  return cachedPermissions.admins.find(admin => admin.discordId === discordUserId) || null;
}

// [FUNC] Check if admin has specific permission
export function hasPermission(discordUserId: string, permission: string): boolean {
  if (!cachedPermissions) return false;
  
  const admin = getAdminInfo(discordUserId);
  if (!admin) return false;
  
  const rolePermissions = cachedPermissions.roles[admin.role];
  return rolePermissions?.includes(permission) || false;
}

// [FUNC] Get mod download URL
export function getModDownloadUrl(modId: string): string {
  return `${MARKETPLACE_CONFIG.MODS_BASE_URL}/${modId}/mod.fantome`;
}

// [FUNC] Get mod preview URL (raw.githubusercontent - cached by CDN)
export function getModPreviewUrl(modId: string): string {
  return `${MARKETPLACE_CONFIG.MODS_BASE_URL}/${modId}/preview.jpg`;
}

// [FUNC] Get mod preview URL via GitHub API (bypasses CDN cache)
export function getModPreviewApiUrl(modId: string): string {
  return `https://api.github.com/repos/${MARKETPLACE_CONFIG.GITHUB_OWNER}/${MARKETPLACE_CONFIG.GITHUB_REPO}/contents/mods/${modId}/preview.jpg`;
}

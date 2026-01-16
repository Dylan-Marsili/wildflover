/**
 * File: index.ts
 * Author: Wildflover
 * Description: API services barrel export - Centralized access to all API modules
 * Language: TypeScript
 */

// [SERVICE-EXPORTS] Main API services
export { versionService } from './version';
export { championService } from './champions';
export { skinService } from './skins';
export { 
  getUpcomingSkins, 
  getLatestPatchSkins, 
  clearPBECache, 
  formatRarity, 
  setPBELocale,
  updateSkinLocale,
  updateLatestSkinLocale 
} from './pbe';
export type { PBESkin, LatestPatchSkin } from './pbe';

// [CDN-EXPORTS] CDN utility functions
export {
  DDRAGON_CDN,
  CDRAGON_CDN,
  LOCALE_MAP,
  buildAssetUrl,
  buildChampionDataUrl,
  buildChampionDetailUrl,
  buildChampionIconUrl,
  buildChampionSplashUrl,
  buildChampionLoadingUrl,
  buildRarityGemUrl,
  getLocale
} from './cdn';

/**
 * Initialize all API services
 * Call this on app startup to preload version and champion data
 */
export async function initializeAPI(langCode: string = 'en'): Promise<void> {
  const { versionService } = await import('./version');
  const { championService } = await import('./champions');
  
  console.log('[API-INIT] Starting initialization...');
  
  // Load version first
  await versionService.fetchLatest();
  
  // Then load champions
  await championService.fetchChampions(langCode);
  
  console.log('[API-INIT] Initialization complete');
}

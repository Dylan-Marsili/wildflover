/**
 * File: cdn.ts
 * Author: Wildflover
 * Description: CDN URL builders for DDragon and Community Dragon assets
 * Language: TypeScript
 */

// ============================================================================
// CDN BASE URLS
// ============================================================================

// [DDRAGON] Official Riot Data Dragon CDN
export const DDRAGON_CDN = 'https://ddragon.leagueoflegends.com/cdn';

// [CDRAGON] Community Dragon Raw CDN for game assets (using pbe branch - latest is deprecated)
export const CDRAGON_CDN = 'https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global';

// [CDRAGON-DEFAULT] Default locale path
export const CDRAGON_DEFAULT = `${CDRAGON_CDN}/default`;

// ============================================================================
// LOCALE MAPPING - DDragon supported locales
// ============================================================================

export const LOCALE_MAP: Record<string, string> = {
  'en': 'en_US',
  'tr': 'tr_TR',
  'ar': 'ar_AE',
  'zh': 'zh_CN',
  'ja': 'ja_JP',
  'ko': 'ko_KR',
  'de': 'de_DE'
} as const;

// ============================================================================
// URL BUILDERS
// ============================================================================

/**
 * Converts Community Dragon asset path to full URL
 * Input:  /lol-game-data/assets/ASSETS/Characters/Annie/Skins/Skin13/Images/annie_splash_centered_13.jpg
 * Output: https://raw.communitydragon.org/latest/.../assets/characters/annie/skins/skin13/images/annie_splash_centered_13.jpg
 */
export function buildAssetUrl(path: string): string {
  if (!path) return '';
  
  // Remove /lol-game-data/assets/ prefix and convert to lowercase
  const cleanPath = path
    .replace('/lol-game-data/assets/', '')
    .toLowerCase();
  
  return `${CDRAGON_DEFAULT}/${cleanPath}`;
}

/**
 * Builds DDragon champion data URL
 * @param version - Game version (e.g., "15.1.1")
 * @param locale - Locale code (e.g., "en_US", "tr_TR")
 */
export function buildChampionDataUrl(version: string, locale: string): string {
  return `${DDRAGON_CDN}/${version}/data/${locale}/champion.json`;
}

/**
 * Builds Community Dragon champion detail URL with locale support
 * @param championKey - Champion numeric key (e.g., 266 for Aatrox)
 * @param locale - Locale code (e.g., "tr_tr", "en_us")
 */
export function buildChampionDetailUrl(championKey: number, locale: string = 'default'): string {
  // Community Dragon uses lowercase locale codes
  const localePath = locale === 'default' ? 'default' : locale.toLowerCase();
  return `${CDRAGON_CDN}/${localePath}/v1/champions/${championKey}.json`;
}

/**
 * Builds DDragon champion icon URL
 * @param version - Game version
 * @param championId - Champion string ID (e.g., "Aatrox")
 */
export function buildChampionIconUrl(version: string, championId: string): string {
  return `${DDRAGON_CDN}/${version}/img/champion/${championId}.png`;
}

/**
 * Builds DDragon champion splash art URL (centered splash)
 * @param championId - Champion string ID (e.g., "Aatrox")
 * @param skinNum - Skin number (0 for default)
 */
export function buildChampionSplashUrl(championId: string, skinNum: number = 0): string {
  return `${DDRAGON_CDN}/img/champion/splash/${championId}_${skinNum}.jpg`;
}

/**
 * Builds DDragon champion loading screen URL
 * @param championId - Champion string ID (e.g., "Aatrox")
 * @param skinNum - Skin number (0 for default)
 */
export function buildChampionLoadingUrl(championId: string, skinNum: number = 0): string {
  return `${DDRAGON_CDN}/img/champion/loading/${championId}_${skinNum}.jpg`;
}

/**
 * Builds rarity gem icon URL from Community Dragon
 * @param rarity - Rarity type (epic, legendary, mythic, ultimate, transcendent)
 * URL: https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/rarity-gem-icons/epic.png
 */
export function buildRarityGemUrl(rarity: string): string {
  // Convert kEpic -> epic, kLegendary -> legendary etc.
  const rarityName = rarity.replace('k', '').toLowerCase();
  return `${CDRAGON_DEFAULT}/v1/rarity-gem-icons/${rarityName}.png`;
}


/**
 * Converts app locale to DDragon locale format
 * @param langCode - App language code (e.g., "tr")
 * @returns DDragon locale (e.g., "tr_TR")
 */
export function getLocale(langCode: string): string {
  return LOCALE_MAP[langCode] || 'en_US';
}

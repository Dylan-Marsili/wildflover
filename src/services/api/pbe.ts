/**
 * File: pbe.ts
 * Author: Wildflover
 * Description: PBE and Latest Patch skins API service with locale support
 * Language: TypeScript
 */

import { buildRarityGemUrl } from './cdn';

// [CDN] Community Dragon branch URLs
const CDRAGON_PBE = 'https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global';
const CDRAGON_LATEST = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global';

// [DDRAGON] Version API
const DDRAGON_VERSIONS = 'https://ddragon.leagueoflegends.com/api/versions.json';

// [INTERFACE] PBE Skin data structure
export interface PBESkin {
  id: number;
  name: string;
  championId: number;
  championName: string;
  splashPath: string;
  loadScreenPath: string;
  rarity: string;
  rarityGemPath: string;
  isNew: boolean;
  patchVersion: string;
  skinLine: string;
  estimatedPrice: string;
  skinLineId?: number;  // For locale updates
}

// [INTERFACE] Latest patch skin data
export interface LatestPatchSkin {
  id: number;
  name: string;
  championId: number;
  championName: string;
  splashPath: string;
  loadScreenPath: string;
  rarity: string;
  rarityGemPath: string;
  patchVersion: string;
  skinLine: string;
  estimatedPrice: string;
  skinLineId?: number;  // For locale updates
}

// [INTERFACE] Raw skin data from CDN
interface RawSkinData {
  id: number;
  name: string;
  splashPath: string;
  uncenteredSplashPath: string;
  tilePath: string;
  loadScreenPath: string;
  rarity: string;
  isBase: boolean;
  chromas?: unknown[];
  skinLines?: Array<{ id: number }>;
}

// [INTERFACE] Champion summary data
interface ChampionSummary {
  id: number;
  name: string;
  alias: string;
}

// [INTERFACE] Skin line data
interface SkinLineData {
  id: number;
  name: string;
  description?: string;
}

// [CACHE] In-memory cache - locale-aware with separate name cache
let memoryPBECache: PBESkin[] | null = null;
let memoryLatestCache: LatestPatchSkin[] | null = null;
let skinLinesCache: Map<number, string> | null = null;
let currentLocale: string = 'default';
let cachedPatchVersion: string | null = null;

// [LOCALE-MAP] Locale name cache for quick updates without full reload
interface LocaleNameCache {
  locale: string;
  skinNames: Map<number, string>;      // skinId -> localized name
  championNames: Map<number, string>;  // championId -> localized name
}
let localeNameCache: LocaleNameCache | null = null;

/**
 * Gets locale code for CDragon API
 */
function getLocaleCode(langCode: string): string {
  const localeMap: Record<string, string> = {
    'en': 'default',
    'tr': 'tr_tr',
    'ar': 'ar_ae',
    'zh': 'zh_cn',
    'ja': 'ja_jp',
    'ko': 'ko_kr',
    'de': 'de_de'
  };
  return localeMap[langCode] || 'default';
}

/**
 * Estimates price based on rarity tier
 */
function getEstimatedPrice(rarity: string): string {
  const priceMap: Record<string, string> = {
    'kNoRarity': '975 RP',
    'kEpic': '1350 RP',
    'kLegendary': '1820 RP',
    'kUltimate': '3250 RP',
    'kMythic': 'Mythic Essence',
    'kTranscendent': 'Mythic Essence',
    'kExalted': 'Event Exclusive'
  };
  return priceMap[rarity] || '1350 RP';
}

/**
 * Fetches skin lines data from CDragon
 */
async function fetchSkinLines(baseUrl: string): Promise<Map<number, string>> {
  if (skinLinesCache) return skinLinesCache;
  
  try {
    const response = await fetch(`${baseUrl}/${currentLocale}/v1/skinlines.json`);
    if (!response.ok) throw new Error('Failed to fetch skin lines');
    
    const data: SkinLineData[] = await response.json();
    const map = new Map<number, string>();
    
    data.forEach(line => {
      if (line.id && line.name) {
        map.set(line.id, line.name);
      }
    });
    
    skinLinesCache = map;
    console.log(`[PBE-SERVICE] Loaded ${map.size} skin lines`);
    return map;
  } catch (error) {
    console.warn('[PBE-SERVICE] Failed to fetch skin lines:', error);
    return new Map();
  }
}

/**
 * Sets the locale for PBE service - only updates names, not full reload
 */
export function setPBELocale(langCode: string): void {
  const newLocale = getLocaleCode(langCode);
  
  if (newLocale !== currentLocale) {
    currentLocale = newLocale;
    // Clear name and skin lines cache on locale change
    localeNameCache = null;
    skinLinesCache = null;
    console.log(`[PBE-SERVICE] Locale changed to: ${currentLocale}`);
  }
}

/**
 * Fetches localized names for skins and champions
 */
async function fetchLocalizedNames(baseUrl: string): Promise<LocaleNameCache> {
  if (localeNameCache && localeNameCache.locale === currentLocale) {
    return localeNameCache;
  }
  
  const skinNames = new Map<number, string>();
  const championNames = new Map<number, string>();
  
  try {
    const [skinsRes, champRes] = await Promise.all([
      fetch(`${baseUrl}/${currentLocale}/v1/skins.json`),
      fetch(`${baseUrl}/${currentLocale}/v1/champion-summary.json`)
    ]);
    
    if (skinsRes.ok) {
      const skins: Record<string, { id: number; name: string }> = await skinsRes.json();
      Object.values(skins).forEach(s => skinNames.set(s.id, s.name));
    }
    
    if (champRes.ok) {
      const champs: Array<{ id: number; name: string }> = await champRes.json();
      champs.forEach(c => { if (c.id > 0) championNames.set(c.id, c.name); });
    }
  } catch (error) {
    console.warn('[PBE-SERVICE] Failed to fetch localized names:', error);
  }
  
  localeNameCache = { locale: currentLocale, skinNames, championNames };
  return localeNameCache;
}

/**
 * Updates skin names with current locale - no full reload
 */
export async function updateSkinLocale(skins: PBESkin[], baseUrl: string = CDRAGON_PBE): Promise<PBESkin[]> {
  const names = await fetchLocalizedNames(baseUrl);
  const skinLines = await fetchSkinLines(baseUrl);
  
  return skins.map(skin => ({
    ...skin,
    name: names.skinNames.get(skin.id) || skin.name,
    championName: names.championNames.get(skin.championId) || skin.championName,
    skinLine: skin.skinLineId ? (skinLines.get(skin.skinLineId) || skin.skinLine) : skin.skinLine
  }));
}

/**
 * Updates latest patch skin names with current locale
 */
export async function updateLatestSkinLocale(skins: LatestPatchSkin[], baseUrl: string = CDRAGON_LATEST): Promise<LatestPatchSkin[]> {
  const names = await fetchLocalizedNames(baseUrl);
  const skinLines = await fetchSkinLines(baseUrl);
  
  return skins.map(skin => ({
    ...skin,
    name: names.skinNames.get(skin.id) || skin.name,
    championName: names.championNames.get(skin.championId) || skin.championName,
    skinLine: skin.skinLineId ? (skinLines.get(skin.skinLineId) || skin.skinLine) : skin.skinLine
  }));
}

/**
 * Gets current patch version from DDragon (e.g., "15.1.1" -> "15.1")
 */
async function getCurrentPatchVersion(): Promise<string> {
  if (cachedPatchVersion) return cachedPatchVersion;
  
  try {
    const response = await fetch(DDRAGON_VERSIONS);
    if (!response.ok) throw new Error('Failed to fetch versions');
    
    const versions: string[] = await response.json();
    if (versions.length > 0) {
      // Convert "15.1.1" to "15.1" format
      const parts = versions[0].split('.');
      cachedPatchVersion = `${parts[0]}.${parts[1]}`;
      console.log(`[PBE-SERVICE] Current patch: ${cachedPatchVersion}`);
      return cachedPatchVersion;
    }
  } catch (error) {
    console.error('[PBE-SERVICE] Failed to get patch version:', error);
  }
  
  return '16.1'; // Fallback to current season
}

/**
 * Gets previous patch version (e.g., "16.1" -> "15.24" or "16.0")
 */
function getPreviousPatchVersion(current: string): string {
  const [season, patch] = current.split('.').map(Number);
  
  if (patch > 1) {
    return `${season}.${patch - 1}`;
  } else {
    // Previous season's last patch (usually 24)
    return `${season - 1}.24`;
  }
}

/**
 * Fetches champion summary list from specified branch
 */
async function fetchChampionSummary(baseUrl: string): Promise<Map<number, ChampionSummary>> {
  try {
    const response = await fetch(`${baseUrl}/${currentLocale}/v1/champion-summary.json`);
    if (!response.ok) throw new Error('Failed to fetch champion summary');
    
    const data: ChampionSummary[] = await response.json();
    const map = new Map<number, ChampionSummary>();
    
    data.forEach(champ => {
      if (champ.id > 0) map.set(champ.id, champ);
    });
    
    return map;
  } catch (error) {
    console.error('[PBE-SERVICE] Failed to fetch champion summary:', error);
    return new Map();
  }
}

/**
 * Builds asset URL for specified base
 */
function buildAssetUrl(path: string, baseUrl: string): string {
  if (!path) return '';
  const cleanPath = path.replace('/lol-game-data/assets/', '').toLowerCase();
  return `${baseUrl}/default/${cleanPath}`;
}

/**
 * Fetches PBE skins with locale support
 */
async function fetchPBESkins(): Promise<PBESkin[]> {
  try {
    const [pbeSkinsRes, liveSkinsRes, championMap, skinLinesMap] = await Promise.all([
      fetch(`${CDRAGON_PBE}/${currentLocale}/v1/skins.json`),
      fetch(`${CDRAGON_LATEST}/default/v1/skins.json`),
      fetchChampionSummary(CDRAGON_PBE),
      fetchSkinLines(CDRAGON_PBE)
    ]);
    
    if (!pbeSkinsRes.ok) throw new Error('Failed to fetch PBE skins');
    
    const pbeSkins: Record<string, RawSkinData> = await pbeSkinsRes.json();
    const liveSkins: Record<string, RawSkinData> = liveSkinsRes.ok ? await liveSkinsRes.json() : {};
    
    const liveSkinIds = new Set(Object.keys(liveSkins));
    const newSkins: PBESkin[] = [];
    
    Object.entries(pbeSkins).forEach(([skinId, skin]) => {
      if (skin.isBase || liveSkinIds.has(skinId)) return;
      
      const championId = Math.floor(skin.id / 1000);
      const champion = championMap.get(championId);
      if (!champion) return;
      
      // Get skin line name
      const skinLineId = skin.skinLines?.[0]?.id;
      const skinLine = skinLineId ? skinLinesMap.get(skinLineId) || '' : '';
      
      newSkins.push({
        id: skin.id,
        name: skin.name,
        championId,
        championName: champion.name,
        splashPath: buildAssetUrl(skin.splashPath, CDRAGON_PBE),
        loadScreenPath: buildAssetUrl(skin.loadScreenPath, CDRAGON_PBE),
        rarity: skin.rarity || 'kNoRarity',
        rarityGemPath: skin.rarity && skin.rarity !== 'kNoRarity' ? buildRarityGemUrl(skin.rarity) : '',
        isNew: true,
        patchVersion: 'PBE',
        skinLine,
        skinLineId,
        estimatedPrice: getEstimatedPrice(skin.rarity || 'kNoRarity')
      });
    });
    
    newSkins.sort((a, b) => a.championName.localeCompare(b.championName));
    console.log(`[PBE-SERVICE] Found ${newSkins.length} upcoming PBE skins`);
    return newSkins;
    
  } catch (error) {
    console.error('[PBE-SERVICE] Failed to fetch PBE skins:', error);
    return [];
  }
}

/**
 * Fetches latest patch skins by comparing current patch with previous patch
 * Uses CDragon patch branches (e.g., 16.1, 16.0) for accurate comparison
 */
async function fetchLatestPatchSkins(): Promise<LatestPatchSkin[]> {
  try {
    const currentPatch = await getCurrentPatchVersion();
    const previousPatch = getPreviousPatchVersion(currentPatch);
    
    // [URL] CDragon patch branch URLs
    const currentBranchUrl = `https://raw.communitydragon.org/${currentPatch}/plugins/rcp-be-lol-game-data/global`;
    const previousBranchUrl = `https://raw.communitydragon.org/${previousPatch}/plugins/rcp-be-lol-game-data/global`;
    
    console.log(`[PBE-SERVICE] Comparing patches: ${currentPatch} vs ${previousPatch}`);
    console.log(`[PBE-SERVICE] Current URL: ${currentBranchUrl}/${currentLocale}/v1/skins.json`);
    
    // [FETCH] Get skins from both patch branches
    const [currentRes, previousRes, championMap, skinLinesMap] = await Promise.all([
      fetch(`${currentBranchUrl}/${currentLocale}/v1/skins.json`),
      fetch(`${previousBranchUrl}/default/v1/skins.json`),
      fetchChampionSummary(currentBranchUrl),
      fetchSkinLines(currentBranchUrl)
    ]);
    
    if (!currentRes.ok) {
      console.warn(`[PBE-SERVICE] Patch ${currentPatch} not available, trying fallback...`);
      return fetchLatestSkinsFromLatest();
    }
    
    const currentSkins: Record<string, RawSkinData> = await currentRes.json();
    const previousSkins: Record<string, RawSkinData> = previousRes.ok ? await previousRes.json() : {};
    
    // [COMPARE] Find skins in current patch but not in previous
    const previousSkinIds = new Set(Object.keys(previousSkins));
    const newSkins: LatestPatchSkin[] = [];
    
    Object.entries(currentSkins).forEach(([skinId, skin]) => {
      if (skin.isBase || previousSkinIds.has(skinId)) return;
      
      const championId = Math.floor(skin.id / 1000);
      const champion = championMap.get(championId);
      if (!champion) return;
      
      // Get skin line name
      const skinLineId = skin.skinLines?.[0]?.id;
      const skinLine = skinLineId ? skinLinesMap.get(skinLineId) || '' : '';
      
      newSkins.push({
        id: skin.id,
        name: skin.name,
        championId,
        championName: champion.name,
        splashPath: buildAssetUrl(skin.splashPath, currentBranchUrl),
        loadScreenPath: buildAssetUrl(skin.loadScreenPath, currentBranchUrl),
        rarity: skin.rarity || 'kNoRarity',
        rarityGemPath: skin.rarity && skin.rarity !== 'kNoRarity' ? buildRarityGemUrl(skin.rarity) : '',
        patchVersion: currentPatch,
        skinLine,
        skinLineId,
        estimatedPrice: getEstimatedPrice(skin.rarity || 'kNoRarity')
      });
    });
    
    // [SORT] Sort by ID descending (newest first)
    newSkins.sort((a, b) => b.id - a.id);
    
    console.log(`[PBE-SERVICE] Found ${newSkins.length} new skins in patch ${currentPatch}`);
    return newSkins;
    
  } catch (error) {
    console.error('[PBE-SERVICE] Failed to fetch latest patch skins:', error);
    return fetchLatestSkinsFromLatest();
  }
}

/**
 * Fallback: fetch recent skins from latest branch
 */
async function fetchLatestSkinsFromLatest(): Promise<LatestPatchSkin[]> {
  try {
    const [skinsRes, championMap, skinLinesMap] = await Promise.all([
      fetch(`${CDRAGON_LATEST}/${currentLocale}/v1/skins.json`),
      fetchChampionSummary(CDRAGON_LATEST),
      fetchSkinLines(CDRAGON_LATEST)
    ]);
    
    if (!skinsRes.ok) return [];
    
    const skins: Record<string, RawSkinData> = await skinsRes.json();
    const recentSkins: LatestPatchSkin[] = [];
    
    const sortedEntries = Object.entries(skins)
      .filter(([, skin]) => !skin.isBase)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .slice(0, 20);
    
    for (const [, skin] of sortedEntries) {
      const championId = Math.floor(skin.id / 1000);
      const champion = championMap.get(championId);
      if (!champion) continue;
      
      // Get skin line name
      const skinLineId = skin.skinLines?.[0]?.id;
      const skinLine = skinLineId ? skinLinesMap.get(skinLineId) || '' : '';
      
      recentSkins.push({
        id: skin.id,
        name: skin.name,
        championId,
        championName: champion.name,
        splashPath: buildAssetUrl(skin.splashPath, CDRAGON_LATEST),
        loadScreenPath: buildAssetUrl(skin.loadScreenPath, CDRAGON_LATEST),
        rarity: skin.rarity || 'kNoRarity',
        rarityGemPath: skin.rarity && skin.rarity !== 'kNoRarity' ? buildRarityGemUrl(skin.rarity) : '',
        patchVersion: 'Latest',
        skinLine,
        skinLineId,
        estimatedPrice: getEstimatedPrice(skin.rarity || 'kNoRarity')
      });
    }
    
    return recentSkins;
  } catch {
    return [];
  }
}

/**
 * Gets upcoming PBE skins
 */
export async function getUpcomingSkins(): Promise<PBESkin[]> {
  if (memoryPBECache) return memoryPBECache;
  
  const skins = await fetchPBESkins();
  memoryPBECache = skins;
  return skins;
}

/**
 * Gets latest patch skins
 */
export async function getLatestPatchSkins(): Promise<LatestPatchSkin[]> {
  if (memoryLatestCache) return memoryLatestCache;
  
  const skins = await fetchLatestPatchSkins();
  memoryLatestCache = skins;
  return skins;
}

/**
 * Clears all caches
 */
export function clearPBECache(): void {
  memoryPBECache = null;
  memoryLatestCache = null;
  cachedPatchVersion = null;
  console.log('[PBE-SERVICE] Cache cleared');
}

/**
 * Transforms rarity string to display format
 */
export function formatRarity(rarity: string): string {
  if (!rarity || rarity === 'kNoRarity') return '';
  return rarity.replace('k', '');
}

export default {
  getUpcomingSkins,
  getLatestPatchSkins,
  clearPBECache,
  formatRarity,
  setPBELocale,
  updateSkinLocale,
  updateLatestSkinLocale
};

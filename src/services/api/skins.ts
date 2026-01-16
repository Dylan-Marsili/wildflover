/**
 * File: skins.ts
 * Author: Wildflover
 * Description: Community Dragon skin service with offline-first strategy
 *              - Stale-While-Revalidate for seamless offline support
 *              - Retry mechanism with exponential backoff
 *              - 30-day stale cache for connection loss scenarios
 * Language: TypeScript
 */

import { buildChampionDetailUrl, buildAssetUrl, LOCALE_MAP } from './cdn';
import { SkinData, ChromaData, SkinRarity, SkinFormData } from '../../types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_KEY_PREFIX = 'wildflover_skins';
const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6 hours - fresh
const STALE_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days - stale but usable
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000;

// [HELPER] Build cache key with locale support
const buildCacheKey = (championKey: number, locale: string): string => {
  return `${CACHE_KEY_PREFIX}_${locale}_${championKey}`;
};

// [HELPER] Get CDragon locale format from app language code
// English uses 'default' path, others use locale code
const getCDragonLocale = (langCode: string): string => {
  if (langCode === 'en') return 'default';
  const mapped = LOCALE_MAP[langCode];
  return mapped ? mapped.toLowerCase() : 'default';
};

// ============================================================================
// RAW API TYPES (Community Dragon Response)
// ============================================================================

interface RawChroma {
  id: number;
  name: string;
  chromaPath: string;
  tilePath: string;
  colors: string[];
}

// [RAW-FORM] Tiered skin form data from API (questSkinInfo.tiers)
interface RawSkinForm {
  id: number;
  name: string;
  stage: number;
  description: string;
  splashPath: string;
  uncenteredSplashPath: string;
  tilePath: string;
  loadScreenPath: string;
  shortName: string;
}

// [RAW-QUEST] Quest skin info containing tiered forms
interface RawQuestSkinInfo {
  name: string;
  productType: string;
  tiers?: RawSkinForm[];
}

interface RawSkin {
  id: number;
  name: string;
  isBase: boolean;
  rarity: string;
  isLegacy: boolean;
  splashPath: string;
  uncenteredSplashPath: string;
  tilePath: string;
  loadScreenPath: string;
  chromas?: RawChroma[];
  questSkinInfo?: RawQuestSkinInfo;
  description: string | null;
}

interface RawChampionDetail {
  id: number;
  name: string;
  skins: RawSkin[];
}

interface SkinCache {
  skins: SkinData[];
  timestamp: number;
  locale: string;
}

// ============================================================================
// SKIN SERVICE
// ============================================================================

class SkinService {
  private static instance: SkinService;
  // [CACHE] Memory cache with locale-aware key: `${locale}_${championKey}`
  private skinCache: Map<string, SkinData[]> = new Map();
  private pendingRequests: Map<string, Promise<SkinData[]>> = new Map();
  private currentLocale: string = 'en';

  private constructor() {
    // [INIT] Don't preload on construct - wait for locale to be set
  }

  public static getInstance(): SkinService {
    if (!SkinService.instance) {
      SkinService.instance = new SkinService();
    }
    return SkinService.instance;
  }

  // --------------------------------------------------------------------------
  // LOCALE MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Set current locale and clear memory cache if locale changed
   * @param langCode - App language code (e.g., "tr", "en")
   */
  public setLocale(langCode: string): void {
    if (this.currentLocale !== langCode) {
      console.log(`[SKIN-LOCALE] Changed: ${this.currentLocale} -> ${langCode}`);
      this.currentLocale = langCode;
      // [CLEAR] Clear memory cache on locale change - localStorage cache is locale-specific
      this.skinCache.clear();
    }
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  // --------------------------------------------------------------------------
  // CACHE MANAGEMENT - Stale-While-Revalidate Strategy
  // --------------------------------------------------------------------------

  private getCacheKey(championKey: number): string {
    return `${this.currentLocale}_${championKey}`;
  }

  /**
   * [CACHE-LOAD] Load from cache with stale data support
   * Returns: { data, isFresh, isStale }
   */
  private loadFromCache(championKey: number): { data: SkinData[] | null; isFresh: boolean; isStale: boolean } {
    try {
      const cacheKey = buildCacheKey(championKey, this.currentLocale);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cacheData: SkinCache = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;
        
        if (!cacheData.skins || cacheData.skins.length === 0) {
          return { data: null, isFresh: false, isStale: false };
        }

        // [FRESH] Under 6 hours
        if (age < CACHE_DURATION) {
          return { data: cacheData.skins, isFresh: true, isStale: false };
        }

        // [STALE] 6h to 30 days - usable but should revalidate
        if (age < STALE_DURATION) {
          console.log(`[SKIN-CACHE] Stale data for champion ${championKey} (age: ${Math.round(age / 3600000)}h)`);
          return { data: cacheData.skins, isFresh: false, isStale: true };
        }

        // [EXPIRED] Over 30 days - still return for offline
        return { data: cacheData.skins, isFresh: false, isStale: true };
      }
    } catch (e) {
      // Silent fail
    }
    return { data: null, isFresh: false, isStale: false };
  }

  private saveToCache(championKey: number, skins: SkinData[]): void {
    try {
      const cacheKey = buildCacheKey(championKey, this.currentLocale);
      const data: SkinCache = { 
        skins, 
        timestamp: Date.now(),
        locale: this.currentLocale 
      };
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[SKIN-CACHE] Storage full, clearing old entries');
      this.clearOldestCache();
    }
  }

  private clearOldestCache(): void {
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .slice(0, 10);
    keys.forEach(k => localStorage.removeItem(k));
  }

  // --------------------------------------------------------------------------
  // DATA TRANSFORMATION
  // --------------------------------------------------------------------------

  private transformRarity(rarity: string): SkinRarity {
    const rarityMap: Record<string, SkinRarity> = {
      'kNoRarity': 'kNoRarity',
      'kEpic': 'kEpic',
      'kLegendary': 'kLegendary',
      'kMythic': 'kMythic',
      'kUltimate': 'kUltimate',
      'kTranscendent': 'kTranscendent',
      'kExalted': 'kExalted'
    };
    return rarityMap[rarity] || 'kNoRarity';
  }

  private transformChroma(raw: RawChroma): ChromaData {
    return {
      id: raw.id,
      name: raw.name,
      chromaPath: buildAssetUrl(raw.chromaPath),
      tilePath: buildAssetUrl(raw.tilePath),
      colors: raw.colors || []
    };
  }

  // [TRANSFORM-FORM] Transform raw skin form to SkinFormData
  private transformForm(raw: RawSkinForm): SkinFormData {
    return {
      id: raw.id,
      name: raw.name,
      stage: raw.stage,
      description: raw.description || '',
      splashPath: buildAssetUrl(raw.splashPath),
      uncenteredSplashPath: buildAssetUrl(raw.uncenteredSplashPath),
      tilePath: buildAssetUrl(raw.tilePath),
      loadScreenPath: buildAssetUrl(raw.loadScreenPath),
      shortName: raw.shortName || raw.name
    };
  }

  private transformSkin(raw: RawSkin): SkinData {
    // [FORMS] Extract tiered forms from questSkinInfo if available
    const forms: SkinFormData[] = raw.questSkinInfo?.tiers
      ?.map(tier => this.transformForm(tier))
      .sort((a, b) => a.stage - b.stage) || [];

    return {
      id: raw.id,
      name: raw.name,
      isBase: raw.isBase,
      rarity: this.transformRarity(raw.rarity),
      isLegacy: raw.isLegacy,
      splashPath: buildAssetUrl(raw.splashPath),
      uncenteredSplashPath: buildAssetUrl(raw.uncenteredSplashPath),
      tilePath: buildAssetUrl(raw.tilePath),
      loadScreenPath: buildAssetUrl(raw.loadScreenPath),
      chromas: raw.chromas?.map(c => this.transformChroma(c)) || [],
      forms,
      description: raw.description
    };
  }

  // --------------------------------------------------------------------------
  // API METHODS - Offline-First with Retry
  // --------------------------------------------------------------------------

  public async fetchSkins(championKey: number): Promise<SkinData[]> {
    const memCacheKey = this.getCacheKey(championKey);
    
    // [MEMORY] Return from memory cache
    if (this.skinCache.has(memCacheKey)) {
      return this.skinCache.get(memCacheKey)!;
    }

    // [CACHE] Check localStorage with stale support
    const { data: cached, isFresh, isStale } = this.loadFromCache(championKey);
    
    if (cached) {
      this.skinCache.set(memCacheKey, cached);
      
      // [FRESH] No need to fetch
      if (isFresh) {
        return cached;
      }
      
      // [STALE] Return immediately, revalidate in background
      if (isStale) {
        this.revalidateSkinsInBackground(championKey);
        return cached;
      }
    }

    // [OFFLINE-CHECK] If no network, return any available cache
    if (!navigator.onLine) {
      console.warn(`[SKIN-OFFLINE] No network for champion ${championKey}`);
      if (cached) {
        return cached;
      }
      return [];
    }

    // [FETCH] No cache or expired, fetch with retry
    if (this.pendingRequests.has(memCacheKey)) {
      return this.pendingRequests.get(memCacheKey)!;
    }

    const promise = this.fetchWithRetry(championKey);
    this.pendingRequests.set(memCacheKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(memCacheKey);
    }
  }

  /**
   * [REVALIDATE] Background revalidation for stale skin data
   */
  private async revalidateSkinsInBackground(championKey: number): Promise<void> {
    if (!navigator.onLine) return;
    
    try {
      const fresh = await this.fetchFromAPI(championKey);
      if (fresh.length > 0) {
        const memCacheKey = this.getCacheKey(championKey);
        this.skinCache.set(memCacheKey, fresh);
        console.log(`[SKIN-REVALIDATE] Champion ${championKey} refreshed in background`);
      }
    } catch (e) {
      // Silent fail - keep stale data
    }
  }

  /**
   * [RETRY] Fetch with exponential backoff retry
   */
  private async fetchWithRetry(championKey: number): Promise<SkinData[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await this.fetchFromAPI(championKey);
        if (result.length > 0) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[SKIN-RETRY] Champion ${championKey} attempt ${attempt}/${RETRY_ATTEMPTS} failed`);
        
        if (attempt < RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`[SKIN-RETRY] Champion ${championKey} all attempts failed:`, lastError);
    
    // [FALLBACK] Return any cached data on complete failure
    const { data: fallback } = this.loadFromCache(championKey);
    return fallback || [];
  }

  private async fetchFromAPI(championKey: number): Promise<SkinData[]> {
    try {
      const cdLocale = getCDragonLocale(this.currentLocale);
      const url = buildChampionDetailUrl(championKey, cdLocale);
      console.log(`[SKIN-API] Fetching champion ${championKey} (locale: ${cdLocale})...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: RawChampionDetail = await response.json();
      
      // Transform skins
      const skins = data.skins.map(s => this.transformSkin(s));
      
      // Cache results
      const memCacheKey = this.getCacheKey(championKey);
      this.skinCache.set(memCacheKey, skins);
      this.saveToCache(championKey, skins);

      console.log(`[SKIN-API] Loaded: ${skins.length} skins for champion ${championKey}`);
      return skins;

    } catch (error) {
      console.error(`[SKIN-ERROR] Failed to fetch champion ${championKey}:`, error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // GETTERS
  // --------------------------------------------------------------------------

  public getSkins(championKey: number): SkinData[] | undefined {
    const memCacheKey = this.getCacheKey(championKey);
    return this.skinCache.get(memCacheKey);
  }

  public hasSkins(championKey: number): boolean {
    const memCacheKey = this.getCacheKey(championKey);
    return this.skinCache.has(memCacheKey);
  }

  // --------------------------------------------------------------------------
  // CACHE CONTROL
  // --------------------------------------------------------------------------

  public clearCache(): void {
    this.skinCache.clear();
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
    console.log('[SKIN-CACHE] Cleared');
  }

  public clearChampionCache(championKey: number): void {
    const memCacheKey = this.getCacheKey(championKey);
    this.skinCache.delete(memCacheKey);
    const storageKey = buildCacheKey(championKey, this.currentLocale);
    localStorage.removeItem(storageKey);
  }

  /**
   * Clear only memory cache - used when locale changes
   */
  public clearMemoryCache(): void {
    this.skinCache.clear();
    console.log('[SKIN-CACHE] Memory cache cleared');
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const skinService = SkinService.getInstance();
export default skinService;

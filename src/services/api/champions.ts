/**
 * File: champions.ts
 * Author: Wildflover
 * Description: DDragon champion service with offline-first strategy
 *              - Stale-While-Revalidate pattern for seamless offline support
 *              - Retry mechanism with exponential backoff
 *              - Persistent cache that survives connection loss
 * Language: TypeScript
 */

import { versionService } from './version';
import { buildChampionDataUrl, getLocale } from './cdn';
import { ChampionBasic } from '../../types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_KEY = 'wildflover_champions_mapping';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours - fresh data
const STALE_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days - stale but usable
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// ============================================================================
// TYPES
// ============================================================================

interface DDragonChampionData {
  key: string;
  id: string;
  name: string;
  title: string;
}

interface DDragonResponse {
  type: string;
  format: string;
  version: string;
  data: Record<string, DDragonChampionData>;
}

interface ChampionCache {
  champions: ChampionBasic[];
  version: string;
  locale: string;
  timestamp: number;
}

// ============================================================================
// CHAMPION SERVICE
// ============================================================================

class ChampionService {
  private static instance: ChampionService;
  private champions: ChampionBasic[] = [];
  private currentLocale: string = 'en_US';
  private isLoading: boolean = false;
  private loadPromise: Promise<ChampionBasic[]> | null = null;

  private constructor() {}

  public static getInstance(): ChampionService {
    if (!ChampionService.instance) {
      ChampionService.instance = new ChampionService();
    }
    return ChampionService.instance;
  }

  // --------------------------------------------------------------------------
  // CACHE MANAGEMENT - Stale-While-Revalidate Strategy
  // --------------------------------------------------------------------------

  /**
   * [CACHE-LOAD] Load from cache with stale data support
   * Returns: { data, isFresh, isStale }
   * - Fresh: Within 24 hours, no revalidation needed
   * - Stale: 24h-30d old, usable but should revalidate in background
   * - Expired: Over 30 days, must fetch new data
   */
  private loadFromCache(locale: string): { data: ChampionBasic[] | null; isFresh: boolean; isStale: boolean } {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${locale}`);
      if (cached) {
        const cacheData: ChampionCache = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;
        
        // [CHECK] Validate cache has data
        if (!cacheData.champions || cacheData.champions.length === 0) {
          return { data: null, isFresh: false, isStale: false };
        }

        // [FRESH] Under 24 hours - use directly
        if (age < CACHE_DURATION) {
          console.log(`[CHAMPION-CACHE] Fresh data loaded: ${cacheData.champions.length} champions`);
          return { data: cacheData.champions, isFresh: true, isStale: false };
        }

        // [STALE] 24h to 30 days - usable but should revalidate
        if (age < STALE_DURATION) {
          console.log(`[CHAMPION-CACHE] Stale data loaded: ${cacheData.champions.length} champions (age: ${Math.round(age / 3600000)}h)`);
          return { data: cacheData.champions, isFresh: false, isStale: true };
        }

        // [EXPIRED] Over 30 days - still return for offline fallback
        console.log(`[CHAMPION-CACHE] Expired data available for offline fallback`);
        return { data: cacheData.champions, isFresh: false, isStale: true };
      }
    } catch (e) {
      console.warn('[CHAMPION-CACHE] Parse error, cache corrupted');
    }
    return { data: null, isFresh: false, isStale: false };
  }

  private saveToCache(champions: ChampionBasic[], locale: string): void {
    try {
      const data: ChampionCache = {
        champions,
        version: versionService.getVersion(),
        locale,
        timestamp: Date.now()
      };
      localStorage.setItem(`${CACHE_KEY}_${locale}`, JSON.stringify(data));
      console.log(`[CHAMPION-CACHE] Saved: ${champions.length} champions`);
    } catch (e) {
      console.warn('[CHAMPION-CACHE] Failed to save');
    }
  }

  // --------------------------------------------------------------------------
  // API METHODS - Offline-First with Retry
  // --------------------------------------------------------------------------

  public async fetchChampions(langCode: string = 'en'): Promise<ChampionBasic[]> {
    const locale = getLocale(langCode);
    
    // [MEMORY] Return from memory if same locale
    if (this.champions.length > 0 && this.currentLocale === locale) {
      return this.champions;
    }

    // [CACHE] Check localStorage with stale support
    const { data: cached, isFresh, isStale } = this.loadFromCache(locale);
    
    if (cached) {
      this.champions = cached;
      this.currentLocale = locale;
      
      // [FRESH] No need to fetch
      if (isFresh) {
        return cached;
      }
      
      // [STALE] Return immediately, revalidate in background
      if (isStale) {
        this.revalidateInBackground(locale);
        return cached;
      }
    }

    // [OFFLINE-CHECK] If no network, return any available cache
    if (!navigator.onLine) {
      console.warn('[CHAMPION-OFFLINE] No network connection');
      if (cached) {
        console.log('[CHAMPION-OFFLINE] Using cached data');
        return cached;
      }
      // Try to load any locale cache as fallback
      const fallback = this.loadAnyAvailableCache();
      if (fallback) {
        console.log('[CHAMPION-OFFLINE] Using fallback cache from different locale');
        this.champions = fallback;
        return fallback;
      }
      return [];
    }

    // [FETCH] No cache or expired, fetch with retry
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.fetchWithRetry(locale);

    try {
      return await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * [REVALIDATE] Background revalidation for stale data
   * User sees stale data immediately while fresh data loads
   */
  private async revalidateInBackground(locale: string): Promise<void> {
    if (!navigator.onLine) return;
    
    console.log('[CHAMPION-REVALIDATE] Background refresh started...');
    try {
      const fresh = await this.fetchFromAPI(locale);
      if (fresh.length > 0) {
        this.champions = fresh;
        this.currentLocale = locale;
        console.log('[CHAMPION-REVALIDATE] Background refresh complete');
      }
    } catch (e) {
      console.warn('[CHAMPION-REVALIDATE] Background refresh failed, keeping stale data');
    }
  }

  /**
   * [RETRY] Fetch with exponential backoff retry
   */
  private async fetchWithRetry(locale: string): Promise<ChampionBasic[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await this.fetchFromAPI(locale);
        if (result.length > 0) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[CHAMPION-RETRY] Attempt ${attempt}/${RETRY_ATTEMPTS} failed`);
        
        if (attempt < RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          console.log(`[CHAMPION-RETRY] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('[CHAMPION-RETRY] All attempts failed:', lastError);
    
    // [FALLBACK] Return any cached data on complete failure
    const { data: fallback } = this.loadFromCache(locale);
    if (fallback) {
      console.log('[CHAMPION-FALLBACK] Using cached data after retry failure');
      return fallback;
    }
    
    return this.champions.length > 0 ? this.champions : [];
  }

  /**
   * [FALLBACK] Load any available cache regardless of locale
   * Used when offline and no matching locale cache exists
   */
  private loadAnyAvailableCache(): ChampionBasic[] | null {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY));
      for (const key of keys) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const data: ChampionCache = JSON.parse(cached);
          if (data.champions && data.champions.length > 0) {
            return data.champions;
          }
        }
      }
    } catch (e) {
      console.warn('[CHAMPION-FALLBACK] Failed to load any cache');
    }
    return null;
  }

  private async fetchFromAPI(locale: string): Promise<ChampionBasic[]> {
    try {
      // Ensure version is loaded
      const version = await versionService.fetchLatest();
      const url = buildChampionDataUrl(version, locale);
      
      console.log(`[CHAMPION-API] Fetching from DDragon v${version}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: DDragonResponse = await response.json();
      
      // Transform to ChampionBasic array
      const champions: ChampionBasic[] = Object.values(data.data).map(champ => ({
        key: parseInt(champ.key, 10),
        id: champ.id,
        name: champ.name,
        title: champ.title
      }));

      // Sort by English ID (consistent across all languages)
      champions.sort((a, b) => a.id.localeCompare(b.id, 'en'));

      this.champions = champions;
      this.currentLocale = locale;
      this.saveToCache(champions, locale);

      console.log(`[CHAMPION-API] Loaded: ${champions.length} champions`);
      return champions;

    } catch (error) {
      console.error('[CHAMPION-ERROR] Failed to fetch:', error);
      return this.champions.length > 0 ? this.champions : [];
    }
  }

  // --------------------------------------------------------------------------
  // GETTERS
  // --------------------------------------------------------------------------

  public getChampions(): ChampionBasic[] {
    return this.champions;
  }

  // --------------------------------------------------------------------------
  // CACHE CONTROL
  // --------------------------------------------------------------------------

  public clearCache(): void {
    this.champions = [];
    // Clear all locale caches
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_KEY)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[CHAMPION-CACHE] Cleared');
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const championService = ChampionService.getInstance();
export default championService;

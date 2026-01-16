/**
 * File: version.ts
 * Author: Wildflover
 * Description: DDragon version API service with offline-first strategy
 *              - Stale-While-Revalidate for seamless offline support
 *              - Dynamic fallback using last successful version
 * Language: TypeScript
 */

// [CONFIG] API and cache settings
const DDRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
const CACHE_KEY = 'wildflover_api_version';
const FALLBACK_KEY = 'wildflover_api_version_fallback';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour - fresh
const STALE_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days - stale but usable
const INITIAL_FALLBACK = '26.1.1'; // Only used if no cached version exists

// [INTERFACE] Cache structure
interface VersionCache {
  version: string;
  timestamp: number;
}

// [CLASS] Version service singleton
class VersionService {
  private static instance: VersionService;
  private currentVersion: string | null = null;
  private isLoading: boolean = false;
  private loadPromise: Promise<string> | null = null;

  private constructor() {
    const { version } = this.loadFromCache();
    if (version) {
      this.currentVersion = version;
    }
  }

  public static getInstance(): VersionService {
    if (!VersionService.instance) {
      VersionService.instance = new VersionService();
    }
    return VersionService.instance;
  }

  // [METHOD] Get dynamic fallback version from cache or use initial
  private getFallbackVersion(): string {
    try {
      const stored = localStorage.getItem(FALLBACK_KEY);
      if (stored) {
        console.log('[VERSION-FALLBACK] Using cached:', stored);
        return stored;
      }
    } catch (e) {
      // Silent fail
    }
    console.log('[VERSION-FALLBACK] Using initial:', INITIAL_FALLBACK);
    return INITIAL_FALLBACK;
  }

  // [METHOD] Save successful version as fallback
  private saveFallbackVersion(version: string): void {
    try {
      localStorage.setItem(FALLBACK_KEY, version);
      console.log('[VERSION-FALLBACK] Saved:', version);
    } catch (e) {
      // Silent fail
    }
  }

  // [METHOD] Load version from cache with freshness check
  private loadFromCache(): { version: string | null; isFresh: boolean; isStale: boolean } {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: VersionCache = JSON.parse(cached);
        const age = Date.now() - data.timestamp;

        if (!data.version) {
          return { version: null, isFresh: false, isStale: false };
        }

        if (age < CACHE_DURATION) {
          console.log('[VERSION-CACHE] Fresh:', data.version);
          return { version: data.version, isFresh: true, isStale: false };
        }

        if (age < STALE_DURATION) {
          console.log('[VERSION-CACHE] Stale:', data.version);
          return { version: data.version, isFresh: false, isStale: true };
        }

        return { version: data.version, isFresh: false, isStale: true };
      }
    } catch (e) {
      console.warn('[VERSION-CACHE] Parse error');
    }
    return { version: null, isFresh: false, isStale: false };
  }

  // [METHOD] Save version to cache and update fallback
  private saveToCache(version: string): void {
    try {
      const data: VersionCache = { version, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      // Also save as fallback for future offline use
      this.saveFallbackVersion(version);
    } catch (e) {
      console.warn('[VERSION-CACHE] Save failed');
    }
  }

  // [METHOD] Fetch latest version with offline-first strategy
  public async fetchLatest(): Promise<string> {
    const { version: cached, isFresh, isStale } = this.loadFromCache();

    if (cached) {
      this.currentVersion = cached;
      if (isFresh) return cached;
      if (isStale) {
        this.revalidateInBackground();
        return cached;
      }
    }

    if (!navigator.onLine) {
      console.warn('[VERSION-OFFLINE] No network');
      if (cached) return cached;
      const fallback = this.getFallbackVersion();
      this.currentVersion = fallback;
      return fallback;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.fetchFromAPI();

    try {
      return await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  // [METHOD] Background revalidation for stale cache
  private async revalidateInBackground(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const response = await fetch(DDRAGON_VERSIONS_URL);
      if (response.ok) {
        const versions: string[] = await response.json();
        if (versions?.[0]) {
          this.currentVersion = versions[0];
          this.saveToCache(versions[0]);
          console.log('[VERSION-REVALIDATE] Updated:', versions[0]);
        }
      }
    } catch (e) {
      // Silent fail
    }
  }

  // [METHOD] Fetch version from DDragon API
  private async fetchFromAPI(): Promise<string> {
    try {
      console.log('[VERSION-API] Fetching...');
      const response = await fetch(DDRAGON_VERSIONS_URL);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const versions: string[] = await response.json();
      if (versions?.[0]) {
        this.currentVersion = versions[0];
        this.saveToCache(versions[0]);
        console.log('[VERSION-API] Latest:', versions[0]);
        return versions[0];
      }
      throw new Error('Empty list');
    } catch (error) {
      console.error('[VERSION-ERROR]', error);
      const fallback = this.getFallbackVersion();
      this.currentVersion = fallback;
      return fallback;
    }
  }

  // [METHOD] Get current version
  public getVersion(): string {
    return this.currentVersion || this.getFallbackVersion();
  }

  // [METHOD] Check if version is loaded
  public isLoaded(): boolean {
    return this.currentVersion !== null;
  }

  // [METHOD] Clear cache (keeps fallback)
  public clearCache(): void {
    this.currentVersion = null;
    localStorage.removeItem(CACHE_KEY);
  }

  // [METHOD] Force refresh version
  public async refresh(): Promise<string> {
    this.currentVersion = null;
    return this.fetchLatest();
  }
}

// [EXPORT] Singleton instance
export const versionService = VersionService.getInstance();
export default versionService;

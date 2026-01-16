/**
 * File: imagePreloader.ts
 * Author: Wildflover
 * Description: Memory-optimized image preloader with LRU cache and lazy loading
 *              - LRU eviction policy for bounded memory usage
 *              - Memory pressure monitoring with auto-cleanup
 *              - Priority-based loading (visible content first)
 *              - Lazy loading for on-demand resource fetching
 * Language: TypeScript
 */

import { ChampionFull } from '../types';
import { LRUCache } from './cache/LRUCache';

// [CONFIG] Cache and memory configuration
const CACHE_CONFIG = {
  MAX_CACHE_SIZE: 80,           // Maximum images in LRU cache
  MEMORY_CHECK_INTERVAL: 30000, // Check memory every 30 seconds
  MEMORY_THRESHOLD_MB: 200,     // Trigger cleanup above this threshold
  CLEANUP_BATCH_SIZE: 20,       // Remove this many images on cleanup
  PRELOAD_BATCH_SIZE: 3,        // Concurrent preload limit
  IDLE_PRELOAD_DELAY: 2000      // Delay before background preload starts
};

// [INTERFACE] Preloader status
interface PreloaderStatus {
  total: number;
  loaded: number;
  failed: number;
  isComplete: boolean;
  cacheSize: number;
  memoryUsageMB: number;
}

// [INTERFACE] Load priority levels
type LoadPriority = 'critical' | 'high' | 'normal' | 'low';

// [INTERFACE] Priority queue item
interface QueueItem {
  url: string;
  priority: LoadPriority;
  resolve: () => void;
}

// [CLASS] Memory-optimized image preloader with LRU cache
class ImagePreloader {
  private lruCache: LRUCache<HTMLImageElement>;
  private loadingImages: Set<string> = new Set();
  private failedImages: Set<string> = new Set();
  private priorityQueue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private memoryCheckInterval: number | null = null;
  
  private status: PreloaderStatus = {
    total: 0,
    loaded: 0,
    failed: 0,
    isComplete: false,
    cacheSize: 0,
    memoryUsageMB: 0
  };
  
  private listeners: Array<(status: PreloaderStatus) => void> = [];

  constructor() {
    this.lruCache = new LRUCache<HTMLImageElement>(CACHE_CONFIG.MAX_CACHE_SIZE);
    this.startMemoryMonitor();
  }

  // [METHOD] Start periodic memory monitoring
  private startMemoryMonitor(): void {
    if (typeof window === 'undefined') return;

    this.memoryCheckInterval = window.setInterval(() => {
      this.checkMemoryPressure();
    }, CACHE_CONFIG.MEMORY_CHECK_INTERVAL);

    console.log('[IMAGE-PRELOADER] Memory monitor started');
  }

  // [METHOD] Check memory pressure and cleanup if needed
  private checkMemoryPressure(): void {
    const memoryMB = this.lruCache.memoryMB;
    
    if (memoryMB > CACHE_CONFIG.MEMORY_THRESHOLD_MB) {
      console.log(`[IMAGE-PRELOADER] Memory pressure detected: ${memoryMB.toFixed(1)}MB`);
      const evicted = this.lruCache.evict(CACHE_CONFIG.CLEANUP_BATCH_SIZE);
      console.log(`[IMAGE-PRELOADER] Evicted ${evicted} images from cache`);
      this.updateStatus();
    }
  }

  // [METHOD] Update and notify status
  private updateStatus(): void {
    this.status.cacheSize = this.lruCache.size;
    this.status.memoryUsageMB = this.lruCache.memoryMB;
    this.notifyListeners();
  }

  // [METHOD] Notify all status listeners
  private notifyListeners(): void {
    const statusCopy = { ...this.status };
    this.listeners.forEach(listener => listener(statusCopy));
  }

  // [METHOD] Check if image is cached
  isLoaded(url: string): boolean {
    return this.lruCache.has(url);
  }

  // [METHOD] Get cached image element (updates LRU order)
  getCachedImage(url: string): HTMLImageElement | null {
    return this.lruCache.get(url);
  }

  // [METHOD] Get current preloader status
  getStatus(): PreloaderStatus {
    return { ...this.status };
  }

  // [METHOD] Add status change listener
  addStatusListener(listener: (status: PreloaderStatus) => void): void {
    this.listeners.push(listener);
  }

  // [METHOD] Remove status change listener
  removeStatusListener(listener: (status: PreloaderStatus) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // [METHOD] Estimate image size based on dimensions
  private estimateImageSize(img: HTMLImageElement): number {
    const pixels = img.naturalWidth * img.naturalHeight;
    return (pixels * 4) / (1024 * 1024); // RGBA bytes to MB
  }

  // [METHOD] Load single image with promise
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const cached = this.lruCache.get(url);
      if (cached) {
        resolve(cached);
        return;
      }

      if (this.loadingImages.has(url)) {
        reject(new Error('Already loading'));
        return;
      }

      this.loadingImages.add(url);
      const img = new Image();

      img.onload = () => {
        this.loadingImages.delete(url);
        const sizeMB = this.estimateImageSize(img);
        this.lruCache.set(url, img, sizeMB);
        this.status.loaded++;
        this.updateStatus();
        resolve(img);
      };

      img.onerror = () => {
        this.loadingImages.delete(url);
        this.failedImages.add(url);
        this.status.failed++;
        this.updateStatus();
        reject(new Error(`Failed to load: ${url}`));
      };

      img.src = url;
    });
  }

  // [METHOD] Add URL to priority queue
  private enqueue(url: string, priority: LoadPriority): Promise<void> {
    return new Promise((resolve) => {
      if (this.lruCache.has(url) || this.loadingImages.has(url) || this.failedImages.has(url)) {
        resolve();
        return;
      }

      this.priorityQueue.push({ url, priority, resolve });
      this.sortQueue();
      this.processQueue();
    });
  }

  // [METHOD] Sort queue by priority
  private sortQueue(): void {
    const priorityOrder: Record<LoadPriority, number> = {
      critical: 0, high: 1, normal: 2, low: 3
    };
    this.priorityQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // [METHOD] Process priority queue with concurrency limit
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.priorityQueue.length > 0) {
      const batch = this.priorityQueue.splice(0, CACHE_CONFIG.PRELOAD_BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(async (item) => {
          try { await this.loadImage(item.url); } catch { /* handled */ }
          item.resolve();
        })
      );
    }

    this.isProcessingQueue = false;
  }

  // [METHOD] Preload single image with priority (public API)
  async preload(url: string, priority: LoadPriority = 'normal'): Promise<void> {
    await this.enqueue(url, priority);
  }

  // [METHOD] Preload multiple images with priority
  async preloadBatch(urls: string[], priority: LoadPriority = 'normal'): Promise<void> {
    await Promise.all(urls.map(url => this.enqueue(url, priority)));
  }

  // [METHOD] Preload specific champion's images (high priority)
  async preloadChampion(champion: ChampionFull): Promise<void> {
    const criticalUrls: string[] = [];
    const highUrls: string[] = [];

    champion.skins.forEach((skin, index) => {
      if (index === 0) {
        if (skin.splashPath) criticalUrls.push(skin.splashPath);
        if (skin.loadScreenPath) criticalUrls.push(skin.loadScreenPath);
      } else {
        if (skin.splashPath) highUrls.push(skin.splashPath);
        if (skin.loadScreenPath) highUrls.push(skin.loadScreenPath);
      }
    });

    await this.preloadBatch(criticalUrls, 'critical');
    await this.preloadBatch(highUrls, 'high');
    console.log(`[IMAGE-PRELOADER] Champion preloaded: ${champion.name}`);
  }

  // [METHOD] Preload visible skin immediately
  async preloadSkin(splashPath: string | null, loadScreenPath: string | null): Promise<void> {
    const urls: string[] = [];
    if (splashPath) urls.push(splashPath);
    if (loadScreenPath) urls.push(loadScreenPath);
    await this.preloadBatch(urls, 'critical');
  }

  // [METHOD] Background preload for all champions (low priority, lazy)
  async preloadAllChampions(champions: ChampionFull[]): Promise<void> {
    console.log(`[IMAGE-PRELOADER] Starting lazy background preload for ${champions.length} champions`);
    
    let totalUrls = 0;
    champions.forEach(champion => {
      champion.skins.forEach(skin => { if (skin.loadScreenPath) totalUrls++; });
    });

    this.status.total = totalUrls;
    this.status.loaded = 0;
    this.status.failed = 0;
    this.status.isComplete = false;
    this.updateStatus();

    await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.IDLE_PRELOAD_DELAY));

    for (const champion of champions) {
      const loadScreenUrls = champion.skins
        .map(skin => skin.loadScreenPath)
        .filter((url): url is string => url !== null && url !== undefined);

      await this.preloadBatch(loadScreenUrls, 'low');
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.status.isComplete = true;
    this.updateStatus();
    console.log(`[IMAGE-PRELOADER] Background preload complete: ${this.status.loaded} loaded, ${this.status.failed} failed`);
  }

  // [METHOD] Clear all cache and reset state
  clearCache(): void {
    this.lruCache.clear();
    this.loadingImages.clear();
    this.failedImages.clear();
    this.priorityQueue = [];
    this.status = { total: 0, loaded: 0, failed: 0, isComplete: false, cacheSize: 0, memoryUsageMB: 0 };
    this.updateStatus();
    console.log('[IMAGE-PRELOADER] Cache cleared');
  }

  // [METHOD] Force memory cleanup
  forceCleanup(count: number = CACHE_CONFIG.CLEANUP_BATCH_SIZE): number {
    const evicted = this.lruCache.evict(count);
    this.updateStatus();
    console.log(`[IMAGE-PRELOADER] Force cleanup: ${evicted} images evicted`);
    return evicted;
  }

  // [METHOD] Cleanup on destroy
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.clearCache();
    this.listeners = [];
    console.log('[IMAGE-PRELOADER] Destroyed');
  }
}

// [EXPORT] Singleton instance
export const imagePreloader = new ImagePreloader();

/**
 * File: downloadManager.ts
 * Author: Wildflover
 * Description: Global download manager for marketplace mods - persists download state across navigation
 * Language: TypeScript
 */

import { marketplaceService } from './marketplaceService';
import { customsStorage } from './customsStorage';
import { downloadHistoryService } from './downloadHistoryService';
import type { MarketplaceMod } from '../types/marketplace';

// [INTERFACE] Download progress info
export interface DownloadProgress {
  modId: string;
  modName: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
  startedAt: number;
  completedAt?: number;
}

// [TYPE] Download event callback
type DownloadEventCallback = (downloads: Map<string, DownloadProgress>) => void;

// [CLASS] Global download manager singleton
class DownloadManager {
  private activeDownloads: Map<string, DownloadProgress> = new Map();
  private listeners: Set<DownloadEventCallback> = new Set();
  private downloadPromises: Map<string, Promise<void>> = new Map();

  // [METHOD] Fetch external image URL and convert to base64
  private async fetchImageAsBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Compress if too large (max 100KB)
          if (base64.length > 100 * 1024) {
            this.compressImage(base64).then(resolve);
          } else {
            resolve(base64);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // [METHOD] Compress image using canvas
  private compressImage(base64: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        // Max 300x300 for thumbnails
        const maxDim = 300;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = base64;
    });
  }

  // [METHOD] Subscribe to download state changes
  subscribe(callback: DownloadEventCallback): () => void {
    this.listeners.add(callback);
    // Immediately notify with current state
    callback(new Map(this.activeDownloads));
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  // [METHOD] Notify all listeners of state change
  private notifyListeners(): void {
    const snapshot = new Map(this.activeDownloads);
    this.listeners.forEach(callback => callback(snapshot));
  }

  // [METHOD] Check if mod is currently downloading
  isDownloading(modId: string): boolean {
    const progress = this.activeDownloads.get(modId);
    return progress?.status === 'downloading' || progress?.status === 'pending';
  }

  // [METHOD] Get download progress for a mod
  getProgress(modId: string): DownloadProgress | undefined {
    return this.activeDownloads.get(modId);
  }

  // [METHOD] Get all active downloads
  getActiveDownloads(): Map<string, DownloadProgress> {
    return new Map(this.activeDownloads);
  }

  // [METHOD] Start downloading a mod
  async downloadMod(mod: MarketplaceMod): Promise<boolean> {
    // Check if already downloading
    if (this.isDownloading(mod.id)) {
      console.log('[DOWNLOAD-MANAGER] Already downloading:', mod.id);
      return false;
    }

    // Check if already exists in customs
    const existingMod = customsStorage.getMod(`marketplace_${mod.id}`);
    if (existingMod) {
      console.log('[DOWNLOAD-MANAGER] Mod already exists in customs:', mod.name);
      return true;
    }

    // Check if there's an existing promise for this download
    const existingPromise = this.downloadPromises.get(mod.id);
    if (existingPromise) {
      console.log('[DOWNLOAD-MANAGER] Waiting for existing download:', mod.id);
      await existingPromise;
      return this.activeDownloads.get(mod.id)?.status === 'completed';
    }

    // Create download progress entry
    const progress: DownloadProgress = {
      modId: mod.id,
      modName: mod.name,
      status: 'downloading',
      startedAt: Date.now()
    };

    this.activeDownloads.set(mod.id, progress);
    this.notifyListeners();

    console.log('[DOWNLOAD-MANAGER] Starting download:', mod.name);

    // Create and store the download promise
    const downloadPromise = this.executeDownload(mod);
    this.downloadPromises.set(mod.id, downloadPromise);

    try {
      await downloadPromise;
      return this.activeDownloads.get(mod.id)?.status === 'completed';
    } finally {
      this.downloadPromises.delete(mod.id);
    }
  }

  // [METHOD] Execute the actual download
  private async executeDownload(mod: MarketplaceMod): Promise<void> {
    console.log('[DOWNLOAD-MANAGER] executeDownload started for:', mod.name, '| ID:', mod.id);
    
    try {
      console.log('[DOWNLOAD-MANAGER] Calling marketplaceService.downloadMod...');
      const result = await marketplaceService.downloadMod(mod);
      console.log('[DOWNLOAD-MANAGER] Download result received:', JSON.stringify(result));

      if (result.success && result.localPath) {
        console.log('[DOWNLOAD-MANAGER] Download successful, fetching preview...');
        
        // [THUMBNAIL] Always fetch fresh base64 preview for customs storage
        let thumbnailForCustoms: string | null = null;
        let thumbnailForHistory: string | null = null;
        
        // First try to get base64 from API
        const freshPreview = await marketplaceService.fetchModPreview(mod.id);
        if (freshPreview && freshPreview.startsWith('data:')) {
          thumbnailForCustoms = freshPreview;
          console.log('[DOWNLOAD-MANAGER] Fresh base64 preview fetched for customs');
        } else if (mod.previewUrl && mod.previewUrl.startsWith('data:')) {
          // Fallback to existing base64 if available
          thumbnailForCustoms = mod.previewUrl;
          console.log('[DOWNLOAD-MANAGER] Using existing base64 preview');
        } else if (mod.previewUrl && mod.previewUrl.startsWith('http')) {
          // [FALLBACK] Convert external URL to base64
          console.log('[DOWNLOAD-MANAGER] Converting external URL to base64...');
          try {
            thumbnailForCustoms = await this.fetchImageAsBase64(mod.previewUrl);
            if (thumbnailForCustoms) {
              console.log('[DOWNLOAD-MANAGER] External URL converted to base64');
            }
          } catch (e) {
            console.warn('[DOWNLOAD-MANAGER] Failed to convert URL to base64:', e);
          }
        }
        
        // For history, only store external URLs (not base64) to save space
        if (mod.previewUrl && !mod.previewUrl.startsWith('data:')) {
          thumbnailForHistory = mod.previewUrl;
        }

        // [THUMBNAIL-FIRST] Save thumbnail to IndexedDB BEFORE adding mod
        // This ensures thumbnail is ready when CustomCard renders (no flash of default icon)
        const modId = `marketplace_${mod.id}`;
        if (thumbnailForCustoms) {
          console.log('[DOWNLOAD-MANAGER] Pre-saving thumbnail to IndexedDB...');
          await customsStorage.saveThumbnailDirect(modId, thumbnailForCustoms);
          console.log('[DOWNLOAD-MANAGER] Thumbnail pre-saved, ready for immediate use');
        }

        // [MOD-ADD] Add to customs storage (thumbnail already in IndexedDB)
        console.log('[DOWNLOAD-MANAGER] Adding mod to customs storage...');
        const addResult = customsStorage.addMod({
          id: modId,
          fileName: `${mod.name}.fantome`,
          displayName: mod.name,
          filePath: result.localPath,
          fileSize: mod.fileSize,
          thumbnailPath: null,
          addedAt: Date.now(),
          isActive: false,
          source: 'marketplace',
          description: mod.description,
          tags: mod.tags
        });

        // Update progress to completed
        this.activeDownloads.set(mod.id, {
          ...this.activeDownloads.get(mod.id)!,
          status: 'completed',
          completedAt: Date.now()
        });

        // [HISTORY] Add to download history (with external URL only, not base64)
        console.log('[DOWNLOAD-MANAGER] Adding to history:', mod.name, '| Author:', mod.author, '| Title:', mod.title);
        try {
          downloadHistoryService.addDownload({
            modId: mod.id,
            modName: mod.name,
            modAuthor: mod.author,
            modTitle: mod.title,
            previewUrl: thumbnailForHistory,
            fileSize: mod.fileSize,
            status: 'completed'
          });
          console.log('[DOWNLOAD-MANAGER] History entry added successfully');
        } catch (historyError) {
          console.error('[DOWNLOAD-MANAGER] Failed to add history entry:', historyError);
        }

        console.log('[DOWNLOAD-MANAGER] Download completed:', mod.name);
      } else {
        console.error('[DOWNLOAD-MANAGER] Download failed - result:', result);
        
        // Update progress to failed
        this.activeDownloads.set(mod.id, {
          ...this.activeDownloads.get(mod.id)!,
          status: 'failed',
          error: result.error || 'Download failed',
          completedAt: Date.now()
        });

        // [HISTORY] Add failed download to history
        console.log('[DOWNLOAD-MANAGER] Adding failed download to history...');
        try {
          downloadHistoryService.addDownload({
            modId: mod.id,
            modName: mod.name,
            modAuthor: mod.author,
            modTitle: mod.title,
            previewUrl: mod.previewUrl || null,
            fileSize: mod.fileSize,
            status: 'failed'
          });
        } catch (historyError) {
          console.error('[DOWNLOAD-MANAGER] Failed to add failed history entry:', historyError);
        }

        console.error('[DOWNLOAD-MANAGER] Download failed:', mod.name, '| Error:', result.error);
      }
    } catch (error) {
      console.error('[DOWNLOAD-MANAGER] Download exception:', mod.name, '| Error:', error);
      
      // Update progress to failed
      this.activeDownloads.set(mod.id, {
        ...this.activeDownloads.get(mod.id)!,
        status: 'failed',
        error: String(error),
        completedAt: Date.now()
      });

      // [HISTORY] Add exception download to history
      try {
        downloadHistoryService.addDownload({
          modId: mod.id,
          modName: mod.name,
          modAuthor: mod.author,
          modTitle: mod.title,
          previewUrl: mod.previewUrl || null,
          fileSize: mod.fileSize,
          status: 'failed'
        });
      } catch (historyError) {
        console.error('[DOWNLOAD-MANAGER] Failed to add exception history entry:', historyError);
      }
    }

    this.notifyListeners();

    // Clean up completed/failed downloads after 5 seconds
    setTimeout(() => {
      const current = this.activeDownloads.get(mod.id);
      if (current && (current.status === 'completed' || current.status === 'failed')) {
        this.activeDownloads.delete(mod.id);
        this.notifyListeners();
      }
    }, 5000);
  }

  // [METHOD] Cancel a download (if possible)
  cancelDownload(modId: string): void {
    const progress = this.activeDownloads.get(modId);
    if (progress && progress.status === 'pending') {
      this.activeDownloads.delete(modId);
      this.notifyListeners();
      console.log('[DOWNLOAD-MANAGER] Download cancelled:', modId);
    }
  }

  // [METHOD] Clear all completed/failed downloads
  clearCompleted(): void {
    for (const [modId, progress] of this.activeDownloads) {
      if (progress.status === 'completed' || progress.status === 'failed') {
        this.activeDownloads.delete(modId);
      }
    }
    this.notifyListeners();
  }
}

// [EXPORT] Singleton instance
export const downloadManager = new DownloadManager();

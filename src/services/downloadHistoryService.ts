/**
 * File: downloadHistoryService.ts
 * Author: Wildflover
 * Description: Quota-safe download history service with automatic size management
 * Language: TypeScript
 */

import type { DownloadHistoryItem } from '../types/marketplace';

// [CONSTANT] Storage configuration
const STORAGE_KEY = 'wildflover_download_history';
const MAX_HISTORY_ITEMS = 50;
const MAX_STORAGE_SIZE_KB = 100; // Max 100KB for history data

// [TYPE] Change listener callback
type HistoryChangeCallback = () => void;

// [CLASS] Quota-safe download history service
class DownloadHistoryService {
  private listeners: Set<HistoryChangeCallback> = new Set();
  private memoryCache: DownloadHistoryItem[] | null = null;

  // [METHOD] Get storage size in KB
  private getStorageSizeKB(data: string): number {
    return new Blob([data]).size / 1024;
  }

  // [METHOD] Sanitize item - remove any base64 data
  private sanitizeItem(item: DownloadHistoryItem): DownloadHistoryItem {
    return {
      ...item,
      // Never store base64 in history - only external URLs
      previewUrl: item.previewUrl?.startsWith('data:') ? null : item.previewUrl
    };
  }

  // [METHOD] Safe save to localStorage with size check
  private safeSave(history: DownloadHistoryItem[]): boolean {
    try {
      // Sanitize all items
      const sanitized = history.map(h => this.sanitizeItem(h));
      const data = JSON.stringify(sanitized);
      const sizeKB = this.getStorageSizeKB(data);

      // If too large, reduce items
      if (sizeKB > MAX_STORAGE_SIZE_KB) {
        console.warn('[DOWNLOAD-HISTORY] Data too large:', sizeKB.toFixed(2), 'KB, reducing...');
        return this.safeSave(sanitized.slice(0, Math.floor(sanitized.length * 0.7)));
      }

      localStorage.setItem(STORAGE_KEY, data);
      this.memoryCache = sanitized;
      console.log('[DOWNLOAD-HISTORY] Saved:', sanitized.length, 'items |', sizeKB.toFixed(2), 'KB');
      return true;
    } catch (error) {
      // Last resort - clear and save minimal
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[DOWNLOAD-HISTORY] Quota error, clearing old data...');
        localStorage.removeItem(STORAGE_KEY);
        const minimal = history.slice(0, 10).map(h => ({ ...this.sanitizeItem(h), previewUrl: null }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
        this.memoryCache = minimal;
        return true;
      }
      console.error('[DOWNLOAD-HISTORY] Save failed:', error);
      return false;
    }
  }

  // [METHOD] Get all download history items
  getHistory(): DownloadHistoryItem[] {
    if (this.memoryCache) return [...this.memoryCache];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const items = JSON.parse(stored) as DownloadHistoryItem[];
      this.memoryCache = items.sort((a, b) => b.downloadedAt - a.downloadedAt);
      return [...this.memoryCache];
    } catch (error) {
      console.error('[DOWNLOAD-HISTORY] Parse failed:', error);
      return [];
    }
  }

  // [METHOD] Add new download to history
  addDownload(item: Omit<DownloadHistoryItem, 'id' | 'downloadedAt'>): void {
    console.log('[DOWNLOAD-HISTORY] Adding:', item.modName);
    
    const history = this.getHistory();
    
    // Remove existing entry if exists
    const filtered = history.filter(h => h.modId !== item.modId);
    
    // Create new item (sanitized - no base64)
    const newItem: DownloadHistoryItem = {
      ...item,
      previewUrl: item.previewUrl?.startsWith('data:') ? null : item.previewUrl,
      id: `${item.modId}_${Date.now()}`,
      downloadedAt: Date.now()
    };

    // Add to beginning and limit size
    filtered.unshift(newItem);
    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);

    if (this.safeSave(trimmed)) {
      this.notifyListeners();
    }
  }

  // [METHOD] Remove single item
  removeItem(itemId: string): void {
    const history = this.getHistory().filter(item => item.id !== itemId);
    if (this.safeSave(history)) {
      console.log('[DOWNLOAD-HISTORY] Removed:', itemId);
      this.notifyListeners();
    }
  }

  // [METHOD] Clear all history
  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.memoryCache = null;
    console.log('[DOWNLOAD-HISTORY] Cleared');
    this.notifyListeners();
  }

  // [METHOD] Get history count
  getCount(): number {
    return this.getHistory().length;
  }

  // [METHOD] Check if mod was downloaded
  wasDownloaded(modId: string): boolean {
    return this.getHistory().some(item => item.modId === modId && item.status === 'completed');
  }

  // [METHOD] Get total downloaded size
  getTotalSize(): number {
    return this.getHistory().reduce((total, item) => total + (item.fileSize || 0), 0);
  }

  // [METHOD] Subscribe to changes
  addChangeListener(callback: HistoryChangeCallback): void {
    this.listeners.add(callback);
  }

  // [METHOD] Unsubscribe
  removeChangeListener(callback: HistoryChangeCallback): void {
    this.listeners.delete(callback);
  }

  // [METHOD] Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  // [METHOD] Sync from customs storage
  syncFromCustomsStorage(customsMods: Array<{
    id: string;
    displayName: string;
    fileSize: number;
    thumbnailPath: string | null;
    addedAt: number;
    tags?: string[];
  }>): void {
    const history = this.getHistory();
    const existingIds = new Set(history.map(h => h.modId));
    
    // Filter marketplace mods not in history
    const toSync = customsMods.filter(mod => {
      if (!mod.id.startsWith('marketplace_')) return false;
      const modId = mod.id.replace('marketplace_', '');
      return !existingIds.has(modId);
    });

    if (toSync.length === 0) return;

    console.log('[DOWNLOAD-HISTORY] Syncing', toSync.length, 'mods');

    for (const mod of toSync) {
      const modId = mod.id.replace('marketplace_', '');
      const authorMatch = mod.displayName.match(/\bby\s+(\S+)/i);
      
      history.push({
        id: `${modId}_${mod.addedAt}`,
        modId,
        modName: mod.displayName,
        modAuthor: authorMatch ? authorMatch[1] : '',
        modTitle: mod.tags?.[0] || 'CUSTOM',
        previewUrl: null, // Never store thumbnails in history
        fileSize: mod.fileSize,
        downloadedAt: mod.addedAt,
        status: 'completed'
      });
    }

    history.sort((a, b) => b.downloadedAt - a.downloadedAt);
    
    if (this.safeSave(history.slice(0, MAX_HISTORY_ITEMS))) {
      this.notifyListeners();
    }
  }
}

// [EXPORT] Singleton instance
export const downloadHistoryService = new DownloadHistoryService();

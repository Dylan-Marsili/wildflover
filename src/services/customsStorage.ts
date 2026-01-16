/**
 * File: customsStorage.ts
 * Author: Wildflover
 * Description: LocalStorage service for custom mod files management
 *              Uses IndexedDB for thumbnails to avoid quota exceeded errors
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';
import { thumbnailStorage } from './thumbnailStorage';
import type { CustomModFile, CustomModStorage, CustomFileExtension, FileImportResult } from '../types/customs';

// [CONSTANTS] Storage configuration
const STORAGE_KEY = 'wildflover_customs';
const STORAGE_VERSION = 1;

// [CONSTANTS] Supported file extensions
const SUPPORTED_EXTENSIONS: CustomFileExtension[] = ['.wad', '.wad.client', '.zip', '.fantome'];

/**
 * Generate unique ID for custom mod
 */
const generateId = (): string => {
  return `mod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get file extension from filename
 */
const getFileExtension = (fileName: string): CustomFileExtension | null => {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.endsWith('.wad.client')) return '.wad.client';
  if (lowerName.endsWith('.fantome')) return '.fantome';
  if (lowerName.endsWith('.wad')) return '.wad';
  if (lowerName.endsWith('.zip')) return '.zip';
  
  return null;
};

/**
 * Validate file extension
 */
const isValidExtension = (fileName: string): boolean => {
  return getFileExtension(fileName) !== null;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};

/**
 * Custom mods storage service
 */
class CustomsStorageService {
  private storage: CustomModStorage;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.storage = this.loadStorage();
  }

  /**
   * Add change listener for reactive updates
   */
  addChangeListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Load storage from localStorage
   */
  private loadStorage(): CustomModStorage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CustomModStorage;
        if (parsed.version === STORAGE_VERSION) {
          console.log('[CUSTOMS-STORAGE] Loaded', parsed.mods.length, 'custom mods');
          // [MIGRATION] Thumbnails are now in IndexedDB, clear from localStorage
          parsed.mods.forEach(mod => {
            if (mod.thumbnailPath) {
              thumbnailStorage.saveThumbnail(mod.id, mod.thumbnailPath);
              mod.thumbnailPath = null;
            }
          });
          return parsed;
        }
      }
    } catch (error) {
      console.error('[CUSTOMS-STORAGE] Failed to load storage:', error);
    }

    return {
      mods: [],
      version: STORAGE_VERSION,
      lastUpdated: Date.now()
    };
  }

  /**
   * Save storage to localStorage - thumbnails stored separately in IndexedDB
   */
  private saveStorage(): void {
    try {
      this.storage.lastUpdated = Date.now();
      
      // [OPTIMIZATION] Remove thumbnails before saving to localStorage
      const storageWithoutThumbnails: CustomModStorage = {
        ...this.storage,
        mods: this.storage.mods.map(mod => ({
          ...mod,
          thumbnailPath: null
        }))
      };
      
      const dataToSave = JSON.stringify(storageWithoutThumbnails);
      const sizeInKB = (dataToSave.length / 1024).toFixed(2);
      console.log('[CUSTOMS-STORAGE] Saving data size:', sizeInKB, 'KB (thumbnails in IndexedDB)');
      
      localStorage.setItem(STORAGE_KEY, dataToSave);
      console.log('[CUSTOMS-STORAGE] Saved', this.storage.mods.length, 'custom mods');
      this.notifyListeners();
    } catch (error) {
      console.error('[CUSTOMS-STORAGE] Failed to save storage:', error);
    }
  }

  /**
   * Get all custom mods - returns deep copy for React state updates
   */
  getAllMods(): CustomModFile[] {
    return this.storage.mods.map(mod => ({ ...mod }));
  }

  /**
   * Get active mods only - returns deep copy for React state updates
   */
  getActiveMods(): CustomModFile[] {
    return this.storage.mods.filter(mod => mod.isActive).map(mod => ({ ...mod }));
  }

  /**
   * Get mod by ID
   */
  getModById(id: string): CustomModFile | null {
    return this.storage.mods.find(mod => mod.id === id) || null;
  }

  /**
   * Check if mod with same file path already exists
   */
  hasModByPath(filePath: string): boolean {
    return this.storage.mods.some(mod => mod.filePath === filePath);
  }

  /**
   * Check if mod with same file name already exists
   */
  hasModByName(fileName: string): boolean {
    return this.storage.mods.some(mod => mod.fileName.toLowerCase() === fileName.toLowerCase());
  }

  /**
   * Add new custom mod from file info
   */
  addMod(fileNameOrMod: string | Partial<CustomModFile>, filePath?: string, fileSize?: number): FileImportResult {
    // [OVERLOAD] Support both old signature and new object-based signature
    if (typeof fileNameOrMod === 'object') {
      const modData = fileNameOrMod as Partial<CustomModFile>;
      
      // [CHECK] Required fields
      if (!modData.id || !modData.fileName || !modData.filePath) {
        return { success: false, error: 'Missing required fields' };
      }
      
      // [CHECK] Duplicate detection
      if (this.hasModByPath(modData.filePath)) {
        return { success: false, error: 'DUPLICATE_FILE', duplicateFileName: modData.fileName };
      }
      
      const newMod: CustomModFile = {
        id: modData.id,
        fileName: modData.fileName,
        extension: modData.extension || getFileExtension(modData.fileName) || '.fantome',
        filePath: modData.filePath,
        fileSize: modData.fileSize || 0,
        displayName: modData.displayName || modData.fileName,
        thumbnailPath: modData.thumbnailPath || null,
        isActive: modData.isActive || false,
        addedAt: modData.addedAt || Date.now(),
        updatedAt: Date.now(),
        description: modData.description || '',
        tags: modData.tags || [],
        source: modData.source || 'local'
      };
      
      this.storage.mods.unshift(newMod);
      this.saveStorage();
      console.log('[CUSTOMS-STORAGE] Added mod from marketplace:', newMod.displayName);
      return { success: true, mod: newMod };
    }
    
    // [LEGACY] Original signature: addMod(fileName, filePath, fileSize)
    const fileName = fileNameOrMod;
    if (!filePath || fileSize === undefined) {
      return { success: false, error: 'Missing required parameters' };
    }
    
    if (!isValidExtension(fileName)) {
      return {
        success: false,
        error: 'Unsupported file format. Only .wad, .wad.client, and .zip files are allowed.'
      };
    }

    // [CHECK] Duplicate file detection
    if (this.hasModByPath(filePath)) {
      return {
        success: false,
        error: 'DUPLICATE_FILE',
        duplicateFileName: fileName
      };
    }

    // [CHECK] Same filename detection
    if (this.hasModByName(fileName)) {
      return {
        success: false,
        error: 'DUPLICATE_NAME',
        duplicateFileName: fileName
      };
    }

    const extension = getFileExtension(fileName)!;
    const displayName = fileName.replace(/\.(wad\.client|wad|zip|fantome)$/i, '');

    const newMod: CustomModFile = {
      id: generateId(),
      fileName,
      extension,
      filePath,
      fileSize,
      displayName,
      thumbnailPath: null,
      isActive: false,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      description: '',
      tags: [],
      source: 'local'
    };

    this.storage.mods.unshift(newMod);
    this.saveStorage();

    console.log('[CUSTOMS-STORAGE] Added mod:', newMod.displayName);

    return {
      success: true,
      mod: newMod
    };
  }

  /**
   * Get mod by ID
   */
  getMod(id: string): CustomModFile | undefined {
    return this.storage.mods.find(m => m.id === id);
  }

  /**
   * Get thumbnail for mod from IndexedDB
   */
  async getThumbnail(modId: string): Promise<string | null> {
    return await thumbnailStorage.getThumbnail(modId);
  }

  /**
   * Save thumbnail directly to IndexedDB without updating mod metadata
   * Used for pre-saving thumbnails before mod is added (prevents default icon flash)
   */
  async saveThumbnailDirect(modId: string, imageData: string): Promise<boolean> {
    try {
      // [COMPRESS] Compress if needed
      const maxSize = 100 * 1024;
      if (imageData.length > maxSize) {
        console.log('[CUSTOMS-STORAGE] Compressing thumbnail before pre-save, size:', (imageData.length / 1024).toFixed(2), 'KB');
        const compressed = await this.compressImageData(imageData);
        if (compressed) {
          await thumbnailStorage.saveThumbnail(modId, compressed);
          console.log('[CUSTOMS-STORAGE] Compressed thumbnail pre-saved');
        } else {
          await thumbnailStorage.saveThumbnail(modId, imageData);
        }
      } else {
        await thumbnailStorage.saveThumbnail(modId, imageData);
      }
      return true;
    } catch (error) {
      console.error('[CUSTOMS-STORAGE] Failed to pre-save thumbnail:', error);
      return false;
    }
  }

  /**
   * Compress image data and return compressed base64
   */
  private async compressImageData(imageData: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        const maxDim = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const compressedData = canvas.toDataURL('image/jpeg', 0.7);
        console.log('[CUSTOMS-STORAGE] Compressed size:', (compressedData.length / 1024).toFixed(2), 'KB');
        resolve(compressedData);
      };
      img.onerror = () => resolve(null);
      img.src = imageData;
    });
  }

  /**
   * Update mod thumbnail image - stores in IndexedDB
   */
  async updateThumbnail(modId: string, imageData: string): Promise<boolean> {
    const mod = this.storage.mods.find(m => m.id === modId);
    if (!mod) return false;

    // [COMPRESS] Compress image if too large (max 100KB base64)
    const maxSize = 100 * 1024;
    if (imageData.length > maxSize) {
      console.log('[CUSTOMS-STORAGE] Compressing thumbnail, original size:', (imageData.length / 1024).toFixed(2), 'KB');
      await this.compressAndSaveThumbnail(mod, imageData);
    } else {
      await thumbnailStorage.saveThumbnail(modId, imageData);
      mod.updatedAt = Date.now();
      this.saveStorage();
      console.log('[CUSTOMS-STORAGE] Updated thumbnail for:', mod.displayName);
    }
    
    return true;
  }

  /**
   * Compress image using canvas and save to IndexedDB
   */
  private async compressAndSaveThumbnail(mod: CustomModFile, imageData: string): Promise<void> {
    const compressed = await this.compressImageData(imageData);
    if (compressed) {
      await thumbnailStorage.saveThumbnail(mod.id, compressed);
    } else {
      await thumbnailStorage.saveThumbnail(mod.id, imageData);
    }
    
    mod.updatedAt = Date.now();
    this.saveStorage();
    this.notifyListeners();
    console.log('[CUSTOMS-STORAGE] Updated compressed thumbnail for:', mod.displayName);
  }

  /**
   * Update mod display name
   */
  updateDisplayName(modId: string, displayName: string): boolean {
    const mod = this.storage.mods.find(m => m.id === modId);
    if (!mod) return false;

    mod.displayName = displayName.trim() || mod.fileName;
    mod.updatedAt = Date.now();
    this.saveStorage();

    return true;
  }

  /**
   * Update mod description
   */
  updateDescription(modId: string, description: string): boolean {
    const mod = this.storage.mods.find(m => m.id === modId);
    if (!mod) return false;

    mod.description = description;
    mod.updatedAt = Date.now();
    this.saveStorage();

    return true;
  }

  /**
   * Toggle mod active state
   */
  toggleActive(modId: string): boolean {
    const mod = this.storage.mods.find(m => m.id === modId);
    if (!mod) return false;

    mod.isActive = !mod.isActive;
    mod.updatedAt = Date.now();
    this.saveStorage();

    console.log('[CUSTOMS-STORAGE] Toggled active:', mod.displayName, '->', mod.isActive);
    return mod.isActive;
  }

  /**
   * Deactivate specific mod
   */
  deactivateMod(modId: string): boolean {
    const mod = this.storage.mods.find(m => m.id === modId);
    if (!mod) return false;

    mod.isActive = false;
    mod.updatedAt = Date.now();
    this.saveStorage();

    console.log('[CUSTOMS-STORAGE] Deactivated mod:', mod.displayName);
    return true;
  }

  /**
   * Deactivate all mods
   */
  deactivateAll(): void {
    this.storage.mods.forEach(mod => {
      mod.isActive = false;
      mod.updatedAt = Date.now();
    });
    this.saveStorage();
    console.log('[CUSTOMS-STORAGE] Deactivated all mods');
  }

  /**
   * Delete mod - clears cache and thumbnail from IndexedDB
   */
  async deleteMod(modId: string): Promise<boolean> {
    const index = this.storage.mods.findIndex(m => m.id === modId);
    if (index === -1) return false;

    const removed = this.storage.mods.splice(index, 1)[0];
    
    // [THUMBNAIL-CLEANUP] Delete from IndexedDB
    await thumbnailStorage.deleteThumbnail(modId);
    
    this.saveStorage();

    // [CACHE-CLEANUP] Delete from backend cache
    try {
      await invoke('delete_custom_mod_cache', { modName: removed.displayName });
      console.log('[CUSTOMS-STORAGE] Cache cleared for:', removed.displayName);
    } catch (error) {
      console.warn('[CUSTOMS-STORAGE] Failed to clear cache:', error);
    }

    // [MARKETPLACE-CLEANUP] If mod is from marketplace
    if (removed.source === 'marketplace' && modId.startsWith('marketplace_')) {
      const marketplaceModId = modId.replace('marketplace_', '');
      try {
        await invoke('delete_marketplace_mod_cache', { modId: marketplaceModId });
        console.log('[CUSTOMS-STORAGE] Marketplace cache cleared for:', marketplaceModId);
      } catch (error) {
        console.warn('[CUSTOMS-STORAGE] Failed to clear marketplace cache:', error);
      }
    }

    console.log('[CUSTOMS-STORAGE] Deleted mod:', removed.displayName);
    return true;
  }

  /**
   * Get total mods count
   */
  getModsCount(): number {
    return this.storage.mods.length;
  }

  /**
   * Get active mods count
   */
  getActiveCount(): number {
    return this.storage.mods.filter(m => m.isActive).length;
  }

  /**
   * Check if file extension is supported
   */
  isSupported(fileName: string): boolean {
    return isValidExtension(fileName);
  }

  /**
   * Get supported extensions list
   */
  getSupportedExtensions(): string[] {
    return [...SUPPORTED_EXTENSIONS];
  }

  /**
   * Repair missing thumbnails - fetches from IndexedDB or marketplace
   */
  async repairMissingThumbnails(): Promise<{ repaired: number; failed: number }> {
    const marketplaceMods = this.storage.mods.filter(mod => mod.source === 'marketplace');

    if (marketplaceMods.length === 0) {
      console.log('[CUSTOMS-STORAGE] No marketplace mods to repair');
      return { repaired: 0, failed: 0 };
    }

    console.log('[CUSTOMS-STORAGE] Checking', marketplaceMods.length, 'marketplace mods...');

    let repaired = 0;
    let failed = 0;

    const { marketplaceService } = await import('./marketplaceService');

    for (const mod of marketplaceMods) {
      try {
        // [CHECK] First check if thumbnail exists in IndexedDB
        const existingThumbnail = await thumbnailStorage.getThumbnail(mod.id);
        if (existingThumbnail) {
          console.log('[CUSTOMS-STORAGE] Thumbnail already in IndexedDB:', mod.displayName);
          continue;
        }

        // [FETCH] Get from marketplace
        const marketplaceModId = mod.id.replace('marketplace_', '');
        const preview = await marketplaceService.fetchModPreview(marketplaceModId);
        
        if (preview && preview.startsWith('data:')) {
          await this.updateThumbnail(mod.id, preview);
          repaired++;
          console.log('[CUSTOMS-STORAGE] Repaired thumbnail for:', mod.displayName);
        } else {
          failed++;
          console.warn('[CUSTOMS-STORAGE] Failed to fetch preview for:', mod.displayName);
        }
      } catch (error) {
        failed++;
        console.error('[CUSTOMS-STORAGE] Thumbnail repair error for:', mod.displayName, error);
      }
    }

    console.log('[CUSTOMS-STORAGE] Thumbnail repair complete | Repaired:', repaired, '| Failed:', failed);
    return { repaired, failed };
  }

  /**
   * Get marketplace mods with missing thumbnails count
   */
  async getMissingThumbnailsCount(): Promise<number> {
    const marketplaceMods = this.storage.mods.filter(mod => mod.source === 'marketplace');
    let missing = 0;

    for (const mod of marketplaceMods) {
      const thumbnail = await thumbnailStorage.getThumbnail(mod.id);
      if (!thumbnail) missing++;
    }

    return missing;
  }
}

// [EXPORT] Singleton instance
export const customsStorage = new CustomsStorageService();

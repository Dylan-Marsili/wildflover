/**
 * File: thumbnailStorage.ts
 * Author: Wildflover
 * Description: IndexedDB service for storing large thumbnail images
 *              Solves localStorage quota exceeded errors by using IndexedDB
 * Language: TypeScript
 */

// [CONSTANTS] IndexedDB configuration
const DB_NAME = 'wildflover_thumbnails';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';

// [INTERFACE] Thumbnail data structure
interface ThumbnailData {
  modId: string;
  imageData: string;
  timestamp: number;
}

/**
 * IndexedDB wrapper for thumbnail storage
 * Provides async API for storing/retrieving large base64 images
 */
class ThumbnailStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB connection
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[THUMBNAIL-STORAGE] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[THUMBNAIL-STORAGE] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'modId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[THUMBNAIL-STORAGE] Object store created');
        }
      };
    });
  }

  /**
   * Ensure DB is initialized before operations
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    
    return this.db;
  }

  /**
   * Save thumbnail to IndexedDB
   */
  async saveThumbnail(modId: string, imageData: string): Promise<boolean> {
    try {
      const db = await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const data: ThumbnailData = {
          modId,
          imageData,
          timestamp: Date.now()
        };
        
        const request = store.put(data);
        
        request.onsuccess = () => {
          console.log('[THUMBNAIL-STORAGE] Saved thumbnail for:', modId);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('[THUMBNAIL-STORAGE] Save failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] Save error:', error);
      return false;
    }
  }

  /**
   * Get thumbnail from IndexedDB
   */
  async getThumbnail(modId: string): Promise<string | null> {
    try {
      const db = await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(modId);
        
        request.onsuccess = () => {
          const result = request.result as ThumbnailData | undefined;
          resolve(result?.imageData || null);
        };
        
        request.onerror = () => {
          console.error('[THUMBNAIL-STORAGE] Get failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] Get error:', error);
      return null;
    }
  }

  /**
   * Delete thumbnail from IndexedDB
   */
  async deleteThumbnail(modId: string): Promise<boolean> {
    try {
      const db = await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(modId);
        
        request.onsuccess = () => {
          console.log('[THUMBNAIL-STORAGE] Deleted thumbnail for:', modId);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('[THUMBNAIL-STORAGE] Delete failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] Delete error:', error);
      return false;
    }
  }

  /**
   * Get all thumbnail IDs
   */
  async getAllThumbnailIds(): Promise<string[]> {
    try {
      const db = await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        
        request.onsuccess = () => {
          resolve(request.result as string[]);
        };
        
        request.onerror = () => {
          console.error('[THUMBNAIL-STORAGE] GetAllKeys failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] GetAllKeys error:', error);
      return [];
    }
  }

  /**
   * Clear all thumbnails
   */
  async clearAll(): Promise<boolean> {
    try {
      const db = await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log('[THUMBNAIL-STORAGE] Cleared all thumbnails');
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('[THUMBNAIL-STORAGE] Clear failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] Clear error:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStats(): Promise<{ count: number; estimatedSize: string }> {
    try {
      const ids = await this.getAllThumbnailIds();
      const count = ids.length;
      
      // Estimate size (rough calculation)
      const estimatedSize = `~${(count * 50).toFixed(0)} KB`;
      
      return { count, estimatedSize };
    } catch (error) {
      console.error('[THUMBNAIL-STORAGE] Stats error:', error);
      return { count: 0, estimatedSize: '0 KB' };
    }
  }
}

// [EXPORT] Singleton instance
export const thumbnailStorage = new ThumbnailStorageService();

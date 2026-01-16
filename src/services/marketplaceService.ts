/**
 * File: marketplaceService.ts
 * Author: Wildflover
 * Description: Frontend service for marketplace operations - catalog fetch, download, upload
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';
import { MARKETPLACE_CONFIG, getModDownloadUrl, getModPreviewUrl, updateCachedPermissions } from '../config/marketplace.config';
import type { 
  MarketplaceCatalog, 
  MarketplaceMod, 
  MarketplaceDownloadResult,
  MarketplaceUploadResult,
  UploadModMetadata 
} from '../types/marketplace';

// [INTERFACE] Catalog fetch result from Rust backend
interface CatalogFetchResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

// [INTERFACE] Preview fetch result from Rust backend
interface PreviewFetchResult {
  success: boolean;
  dataUrl: string | null;
  error: string | null;
}

// [CLASS] Marketplace service singleton
class MarketplaceService {
  private catalog: MarketplaceCatalog | null = null;
  private lastFetchTime: number = 0;
  private downloadCache: Map<string, string> = new Map();

  // [METHOD] Fetch marketplace catalog via Rust backend (bypasses CORS)
  async fetchCatalog(forceRefresh: boolean = false): Promise<MarketplaceCatalog> {
    const now = Date.now();
    const cacheExpired = (now - this.lastFetchTime) > (MARKETPLACE_CONFIG.CACHE_TTL_MINUTES * 60 * 1000);

    // Return cached catalog if valid
    if (!forceRefresh && this.catalog && !cacheExpired) {
      console.log('[MARKETPLACE-SERVICE] Using cached catalog');
      return this.catalog;
    }

    try {
      console.log('[MARKETPLACE-SERVICE] Fetching catalog via Rust backend...');
      
      // Use Rust backend to fetch - bypasses CORS completely
      const result = await invoke<CatalogFetchResult>('fetch_marketplace_catalog', {
        catalogUrl: MARKETPLACE_CONFIG.CATALOG_URL
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch catalog');
      }

      const data = JSON.parse(result.data) as MarketplaceCatalog;
      
      // Enrich mods with full URLs
      data.mods = data.mods.map(mod => ({
        ...mod,
        downloadUrl: mod.downloadUrl || getModDownloadUrl(mod.id),
        previewUrl: mod.previewUrl || getModPreviewUrl(mod.id)
      }));

      // Cache permissions from index.json
      if ((data as any).permissions) {
        updateCachedPermissions((data as any).permissions);
        console.log('[MARKETPLACE-SERVICE] Permissions cached from index.json');
      }

      this.catalog = data;
      this.lastFetchTime = now;
      
      console.log(`[MARKETPLACE-SERVICE] Catalog loaded: ${data.mods.length} mods`);
      return data;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Failed to fetch catalog:', error);
      
      // Return cached data if available on error
      if (this.catalog) {
        console.log('[MARKETPLACE-SERVICE] Returning stale cache due to error');
        return this.catalog;
      }
      
      // Return empty catalog on first load error
      return {
        version: '0.0.0',
        lastUpdated: new Date().toISOString(),
        totalMods: 0,
        mods: []
      };
    }
  }

  // [METHOD] Download mod to local cache
  async downloadMod(mod: MarketplaceMod): Promise<MarketplaceDownloadResult> {
    // Check local cache first
    if (this.downloadCache.has(mod.id)) {
      const cachedPath = this.downloadCache.get(mod.id)!;
      console.log('[MARKETPLACE-SERVICE] Cache hit for mod:', mod.id);
      return { success: true, localPath: cachedPath };
    }

    try {
      console.log('[MARKETPLACE-SERVICE] Downloading mod:', mod.name);
      console.log('[MARKETPLACE-SERVICE] Download URL:', mod.downloadUrl);
      console.log('[MARKETPLACE-SERVICE] Mod ID:', mod.id);
      
      if (!mod.downloadUrl) {
        return {
          success: false,
          error: 'Download URL is missing'
        };
      }
      
      const result = await invoke<MarketplaceDownloadResult>('download_marketplace_mod', {
        modId: mod.id,
        downloadUrl: mod.downloadUrl,
        modName: mod.name
      });

      console.log('[MARKETPLACE-SERVICE] Download result:', result);

      if (result.success && result.localPath) {
        this.downloadCache.set(mod.id, result.localPath);
        
        // Increment download count on GitHub
        const countResult = await this.incrementDownloadCount(mod.id);
        if (countResult.success && countResult.newCount !== undefined) {
          console.log('[MARKETPLACE-SERVICE] Download count updated:', countResult.newCount);
        }
      }

      return result;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Download failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // [METHOD] Increment download count on GitHub
  async incrementDownloadCount(modId: string): Promise<{ success: boolean; newCount?: number }> {
    try {
      const result = await invoke<{ success: boolean; newCount?: number; error?: string }>('increment_download_count', {
        modId,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      if (result.success && result.newCount !== undefined) {
        // Update local catalog
        if (this.catalog) {
          this.catalog.mods = this.catalog.mods.map(m => {
            if (m.id === modId) {
              return { ...m, downloadCount: result.newCount! };
            }
            return m;
          });
        }
        console.log('[MARKETPLACE-SERVICE] Download count incremented:', modId, result.newCount);
      }

      return { success: result.success, newCount: result.newCount };
    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Increment download count failed:', error);
      return { success: false };
    }
  }

  // [METHOD] Upload mod to GitHub (admin only)
  async uploadMod(
    metadata: UploadModMetadata,
    filePath: string,
    previewPath: string | null,
    authorId: string,
    authorName: string,
    authorAvatar: string | null,
    githubToken: string
  ): Promise<MarketplaceUploadResult> {
    try {
      console.log('[MARKETPLACE-SERVICE] Uploading mod:', metadata.name);

      const result = await invoke<MarketplaceUploadResult>('upload_marketplace_mod', {
        metadata: {
          ...metadata,
          author: authorName,
          authorId: authorId,
          authorAvatar: authorAvatar
        },
        filePath,
        previewPath,
        githubToken,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      // Refresh catalog after successful upload
      if (result.success) {
        setTimeout(() => this.fetchCatalog(true), 2000);
      }

      return result;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Upload failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // [METHOD] Delete mod from GitHub (admin only)
  async deleteMod(modId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[MARKETPLACE-SERVICE] Deleting mod:', modId);

      const result = await invoke<{ success: boolean; error?: string }>('delete_marketplace_mod', {
        modId,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      if (result.success) {
        // Remove from local cache
        this.downloadCache.delete(modId);
        
        // Update local catalog immediately
        if (this.catalog) {
          this.catalog.mods = this.catalog.mods.filter(m => m.id !== modId);
          this.catalog.totalMods = this.catalog.mods.length;
        }
        
        console.log('[MARKETPLACE-SERVICE] Mod deleted successfully:', modId);
      }

      return result;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Delete failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // [METHOD] Like/Unlike mod with user info
  async likeMod(
    modId: string, 
    like: boolean,
    userInfo?: { discordId: string; username: string; displayName: string; avatar: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[MARKETPLACE-SERVICE] Like mod:', modId, like);

      const result = await invoke<{ success: boolean; error?: string }>('like_marketplace_mod', {
        modId,
        like,
        userInfo: userInfo || null,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      if (result.success) {
        // Update local catalog with correct likeCount based on likedBy array
        if (this.catalog) {
          this.catalog.mods = this.catalog.mods.map(m => {
            if (m.id === modId) {
              const likedBy = m.likedBy || [];
              let updatedLikedBy = [...likedBy];
              
              if (like && userInfo) {
                // Add user to likedBy if not already there
                if (!updatedLikedBy.find(l => l.discordId === userInfo.discordId)) {
                  updatedLikedBy.push({
                    discordId: userInfo.discordId,
                    username: userInfo.username,
                    displayName: userInfo.displayName,
                    avatar: userInfo.avatar,
                    likedAt: new Date().toISOString()
                  });
                }
              } else if (!like && userInfo) {
                // Remove user from likedBy
                updatedLikedBy = updatedLikedBy.filter(l => l.discordId !== userInfo.discordId);
              }
              
              // [FIX] likeCount must always equal likedBy.length for consistency
              return {
                ...m,
                likeCount: updatedLikedBy.length,
                likedBy: updatedLikedBy
              };
            }
            return m;
          });
        }
        console.log('[MARKETPLACE-SERVICE] Like updated:', modId, like);
      }

      return result;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Like failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // [METHOD] Update mod metadata on GitHub (admin only)
  async updateMod(
    modId: string,
    updates: {
      name: string;
      title: string;
      description: string;
      tags: string[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[MARKETPLACE-SERVICE] Updating mod:', modId);

      const result = await invoke<{ success: boolean; error?: string }>('update_marketplace_mod', {
        modId,
        updates,
        previewBase64: null,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      console.log('[MARKETPLACE-SERVICE] Update result:', result);

      if (result.success) {
        // Update local catalog timestamp for cache-busting
        const timestamp = new Date().toISOString();
        if (this.catalog) {
          this.catalog.mods = this.catalog.mods.map(m => {
            if (m.id === modId) {
              return {
                ...m,
                name: updates.name,
                title: updates.title,
                description: updates.description,
                tags: updates.tags,
                updatedAt: timestamp
              };
            }
            return m;
          });
        }
        console.log('[MARKETPLACE-SERVICE] Mod updated successfully:', modId, 'timestamp:', timestamp);
      }

      return result;

    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Update failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // [METHOD] Check if mod is already downloaded
  isModDownloaded(modId: string): boolean {
    return this.downloadCache.has(modId);
  }

  // [METHOD] Get downloaded mod path
  getDownloadedModPath(modId: string): string | null {
    return this.downloadCache.get(modId) || null;
  }

  // [METHOD] Clear download cache
  clearCache(): void {
    this.downloadCache.clear();
    this.catalog = null;
    this.lastFetchTime = 0;
    console.log('[MARKETPLACE-SERVICE] Cache cleared');
  }

  // [METHOD] Get unique titles from catalog
  getAvailableTitles(): { id: string; name: string; count: number }[] {
    if (!this.catalog) return [];
    
    const titleMap = new Map<string, number>();
    this.catalog.mods.forEach(mod => {
      const count = titleMap.get(mod.title) || 0;
      titleMap.set(mod.title, count + 1);
    });

    return Array.from(titleMap.entries())
      .map(([name, count]) => ({ id: name.toLowerCase(), name, count }))
      .sort((a, b) => b.count - a.count);
  }

  // [METHOD] Get unique tags from catalog
  getAvailableTags(): { tag: string; count: number }[] {
    if (!this.catalog) return [];
    
    const tagMap = new Map<string, number>();
    this.catalog.mods.forEach(mod => {
      mod.tags.forEach(tag => {
        const count = tagMap.get(tag) || 0;
        tagMap.set(tag, count + 1);
      });
    });

    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // [METHOD] Filter and sort mods
  filterMods(
    mods: MarketplaceMod[],
    filters: {
      searchQuery?: string;
      title?: string | null;
      tags?: string[];
      author?: string | null;
      sortBy?: 'newest' | 'popular' | 'mostDownloaded' | 'name' | 'size';
    }
  ): MarketplaceMod[] {
    let filtered = [...mods];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(mod =>
        mod.name.toLowerCase().includes(query) ||
        mod.description.toLowerCase().includes(query) ||
        mod.author.toLowerCase().includes(query) ||
        mod.title.toLowerCase().includes(query) ||
        mod.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Title filter
    if (filters.title) {
      filtered = filtered.filter(mod => 
        mod.title.toLowerCase() === filters.title!.toLowerCase()
      );
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(mod =>
        filters.tags!.some(tag => mod.tags.includes(tag))
      );
    }

    // Author filter
    if (filters.author) {
      filtered = filtered.filter(mod => 
        mod.author.toLowerCase() === filters.author!.toLowerCase()
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      case 'mostDownloaded':
        filtered.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        filtered.sort((a, b) => b.fileSize - a.fileSize);
        break;
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }

  // [METHOD] Fetch mod preview via GitHub API (bypasses CDN cache)
  async fetchModPreview(modId: string): Promise<string | null> {
    try {
      console.log('[MARKETPLACE-SERVICE] Fetching preview via API:', modId);
      
      const result = await invoke<PreviewFetchResult>('fetch_mod_preview', {
        modId,
        githubOwner: MARKETPLACE_CONFIG.GITHUB_OWNER,
        githubRepo: MARKETPLACE_CONFIG.GITHUB_REPO
      });

      if (result.success && result.dataUrl) {
        console.log('[MARKETPLACE-SERVICE] Preview fetched successfully:', modId);
        return result.dataUrl;
      }
      
      console.warn('[MARKETPLACE-SERVICE] Preview fetch failed:', result.error);
      return null;
    } catch (error) {
      console.error('[MARKETPLACE-SERVICE] Preview fetch error:', error);
      return null;
    }
  }
}

// [EXPORT] Singleton instance
export const marketplaceService = new MarketplaceService();

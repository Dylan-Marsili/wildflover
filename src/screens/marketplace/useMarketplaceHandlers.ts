/**
 * File: useMarketplaceHandlers.ts
 * Author: Wildflover
 * Description: Custom hooks for marketplace screen handlers
 * Language: TypeScript
 */

import { useCallback } from 'react';
import { marketplaceService } from '../../services/marketplaceService';
import { customsStorage } from '../../services/customsStorage';
import type { MarketplaceMod, MarketplaceCatalog } from '../../types/marketplace';

// [INTERFACE] Handler dependencies
interface HandlerDeps {
  discordUserId?: string;
  discordUsername?: string;
  likedMods: Set<string>;
  downloadingMods: Set<string>;
  setDownloadingMods: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDownloadedMods: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLikedMods: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCatalog: React.Dispatch<React.SetStateAction<MarketplaceCatalog | null>>;
}

// [HOOK] Download handler
export function useDownloadHandler(deps: Pick<HandlerDeps, 'downloadingMods' | 'setDownloadingMods' | 'setDownloadedMods'>) {
  const { downloadingMods, setDownloadingMods, setDownloadedMods } = deps;
  
  return useCallback(async (mod: MarketplaceMod) => {
    if (downloadingMods.has(mod.id)) return;
    
    const existingMod = customsStorage.getMod(`marketplace_${mod.id}`);
    if (existingMod) {
      console.log('[MARKETPLACE] Mod already exists in customs:', mod.name);
      setDownloadedMods(prev => new Set(prev).add(mod.id));
      return;
    }
    
    console.log('[MARKETPLACE] Starting download:', mod.name);
    setDownloadingMods(prev => new Set(prev).add(mod.id));
    
    try {
      const result = await marketplaceService.downloadMod(mod);
      
      if (result.success && result.localPath) {
        setDownloadedMods(prev => new Set(prev).add(mod.id));
        
        // [FIX] Build jsDelivr URL with cache-bust for customs thumbnail
        const timestamp = mod.updatedAt ? new Date(mod.updatedAt).getTime() : Date.now();
        const thumbnailUrl = `https://cdn.jsdelivr.net/gh/wiildflover/wildflover-marketplace@main/mods/${mod.id}/preview.jpg?t=${timestamp}`;
        
        customsStorage.addMod({
          id: `marketplace_${mod.id}`,
          fileName: `${mod.name}.fantome`,
          displayName: mod.name,
          filePath: result.localPath,
          fileSize: mod.fileSize,
          thumbnailPath: thumbnailUrl,
          addedAt: Date.now(),
          isActive: false,
          source: 'marketplace',
          description: mod.description,
          tags: mod.tags
        });
        
        console.log('[MARKETPLACE] Downloaded and added to customs');
      } else {
        console.error('[MARKETPLACE] Download failed:', result.error);
      }
    } catch (err) {
      console.error('[MARKETPLACE] Download error:', err);
    } finally {
      setDownloadingMods(prev => {
        const next = new Set(prev);
        next.delete(mod.id);
        return next;
      });
    }
  }, [downloadingMods, setDownloadingMods, setDownloadedMods]);
}

// [HOOK] Like handler
export function useLikeHandler(deps: Pick<HandlerDeps, 'discordUserId' | 'discordUsername' | 'likedMods' | 'setLikedMods' | 'setCatalog'>) {
  const { discordUserId, discordUsername, likedMods, setLikedMods, setCatalog } = deps;
  
  return useCallback(async (mod: MarketplaceMod) => {
    const isCurrentlyLiked = likedMods.has(mod.id);
    
    const userInfo = discordUserId ? {
      discordId: discordUserId,
      username: discordUsername || 'Unknown',
      displayName: discordUsername || 'Unknown',
      avatar: null as string | null
    } : undefined;
    
    // Update local state immediately
    setLikedMods(prev => {
      const next = new Set(prev);
      if (isCurrentlyLiked) {
        next.delete(mod.id);
      } else {
        next.add(mod.id);
      }
      localStorage.setItem('wildflover_marketplace_likes', JSON.stringify([...next]));
      return next;
    });

    // [OPTIMISTIC-UPDATE] Update catalog state with correct likeCount
    setCatalog(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        mods: prev.mods.map(m => {
          if (m.id === mod.id) {
            const likedBy = m.likedBy || [];
            let updatedLikedBy = [...likedBy];
            
            if (!isCurrentlyLiked && userInfo) {
              // [ADD] Only add if user not already in likedBy array
              const alreadyLiked = updatedLikedBy.some(l => l.discordId === userInfo.discordId);
              if (!alreadyLiked) {
                updatedLikedBy.push({
                  ...userInfo,
                  likedAt: new Date().toISOString()
                });
              }
            } else if (isCurrentlyLiked && userInfo) {
              // [REMOVE] Filter out current user from likedBy
              updatedLikedBy = updatedLikedBy.filter(l => l.discordId !== userInfo.discordId);
            }
            
            // [FIX] likeCount MUST equal likedBy.length for data consistency
            return {
              ...m,
              likeCount: updatedLikedBy.length,
              likedBy: updatedLikedBy
            };
          }
          return m;
        })
      };
    });

    // Send to backend
    try {
      await marketplaceService.likeMod(mod.id, !isCurrentlyLiked, userInfo);
      console.log('[MARKETPLACE] Like updated:', mod.id, !isCurrentlyLiked);
    } catch (err) {
      console.error('[MARKETPLACE] Like failed:', err);
      // Revert on error
      setLikedMods(prev => {
        const next = new Set(prev);
        if (isCurrentlyLiked) {
          next.add(mod.id);
        } else {
          next.delete(mod.id);
        }
        localStorage.setItem('wildflover_marketplace_likes', JSON.stringify([...next]));
        return next;
      });
    }
  }, [discordUserId, discordUsername, likedMods, setLikedMods, setCatalog]);
}

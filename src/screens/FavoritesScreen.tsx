/**
 * File: FavoritesScreen.tsx
 * Author: Wildflover
 * Description: Favorites screen displaying user's favorite champions
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChampionFull, SkinData } from '../types';
import { skinManager } from '../services/skinManager';
import { skinService } from '../services/api';
import ChampionCard from '../components/ChampionCard';
import SkinSelector from '../components/SkinSelector';
import './FavoritesScreen.css';

interface FavoritesScreenProps {
  champions: ChampionFull[];
  isLocked?: boolean;  // When overlay is active, disable selection
}

const FavoritesScreen = ({ champions, isLocked = false }: FavoritesScreenProps) => {
  const { t } = useTranslation();
  const [favoriteChampions, setFavoriteChampions] = useState<ChampionFull[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<ChampionFull | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // [REF] Cache loaded skins to prevent re-fetching
  const skinsCache = useRef<Map<number, SkinData[]>>(new Map());
  // [REF] Track if initial load is done
  const initialLoadDone = useRef(false);

  // [HELPER] Load champion with skins and correct splash URL
  const loadChampionWithSkins = useCallback(async (champ: ChampionFull): Promise<ChampionFull> => {
    // Check cache first
    let skins = skinsCache.current.get(champ.id);
    
    if (!skins || skins.length === 0) {
      skins = await skinService.fetchSkins(champ.id);
      if (skins.length > 0) {
        skinsCache.current.set(champ.id, skins);
      }
    }
    
    // Get selected skin or use base skin for splash
    const selectedSkinId = skinManager.getSelectedSkin(champ.id);
    const selectedSkin = selectedSkinId 
      ? skins.find(s => s.id === selectedSkinId) 
      : skins.find(s => s.isBase) || skins[0];
    
    return {
      ...champ,
      skins,
      splashUrl: selectedSkin?.splashPath || champ.splashUrl
    };
  }, []);

  // [EFFECT] Initial load of favorites
  useEffect(() => {
    if (initialLoadDone.current || champions.length === 0) return;
    
    const loadFavorites = async () => {
      setIsLoading(true);
      
      const favoriteIds = skinManager.getFavorites();
      const favorites = champions.filter(c => favoriteIds.includes(c.id));
      
      const updatedFavorites = await Promise.all(
        favorites.map(champ => loadChampionWithSkins(champ))
      );
      
      setFavoriteChampions(updatedFavorites);
      setIsLoading(false);
      initialLoadDone.current = true;
      console.log('[FAVORITES-SCREEN] Initial load complete:', updatedFavorites.length);
    };

    loadFavorites();
  }, [champions, loadChampionWithSkins]);

  // [EFFECT] Update only name/title when champions prop changes (language change) - NO FLICKER
  useEffect(() => {
    if (!initialLoadDone.current || favoriteChampions.length === 0) return;
    
    // Update name/title only - preserve skins and splashUrl
    setFavoriteChampions(prev => {
      return prev.map(fav => {
        const updated = champions.find(c => c.id === fav.id);
        if (updated && (updated.name !== fav.name || updated.title !== fav.title)) {
          return {
            ...fav,
            name: updated.name,
            title: updated.title
            // Keep: skins, splashUrl - no change
          };
        }
        return fav;
      });
    });
    
    // Background skin reload for new locale names (no state flicker)
    const favoriteIds = skinManager.getFavorites();
    const favoritesToUpdate = champions.filter(c => favoriteIds.includes(c.id));
    
    // Clear cache and reload skins in background
    skinsCache.current.clear();
    
    Promise.all(
      favoritesToUpdate.map(champ => skinService.fetchSkins(champ.id))
    ).then(results => {
      const selectedSkinsMap = skinManager.getAllSelectedSkins();
      
      setFavoriteChampions(prev => {
        return prev.map((fav, idx) => {
          const skins = results[idx];
          if (!skins || skins.length === 0) return fav;
          
          skinsCache.current.set(fav.id, skins);
          
          const selectedSkinId = selectedSkinsMap.get(fav.id);
          let splashUrl = fav.splashUrl;
          
          if (selectedSkinId) {
            const selectedSkin = skins.find(s => s.id === selectedSkinId);
            if (selectedSkin) {
              splashUrl = selectedSkin.splashPath || splashUrl;
            }
          }
          
          return { ...fav, skins, splashUrl };
        });
      });
    });
  }, [champions]);

  // [EFFECT] Listen for skin/favorite changes
  useEffect(() => {
    const handleChange = async () => {
      setSelectionVersion(v => v + 1);
      
      const favoriteIds = skinManager.getFavorites();
      const favorites = champions.filter(c => favoriteIds.includes(c.id));
      
      // Update favorites with fresh skin data
      const updatedFavorites = await Promise.all(
        favorites.map(champ => loadChampionWithSkins(champ))
      );
      
      setFavoriteChampions(updatedFavorites);
    };

    skinManager.addChangeListener(handleChange);
    return () => skinManager.removeChangeListener(handleChange);
  }, [champions, loadChampionWithSkins]);

  // [HANDLER] Champion click - open skin selector (disabled when overlay active)
  const handleChampionClick = useCallback(async (champion: ChampionFull) => {
    // [LOCK] Prevent selection when overlay is active
    if (isLocked) {
      console.log('[FAVORITES-SCREEN] Selection locked - overlay active');
      return;
    }
    
    // Ensure skins are loaded
    if (champion.skins.length === 0) {
      const skins = await skinService.fetchSkins(champion.id);
      skinsCache.current.set(champion.id, skins);
      setSelectedChampion({ ...champion, skins });
    } else {
      setSelectedChampion(champion);
    }
  }, [isLocked]);

  // [HANDLER] Clear all favorites (disabled when overlay active)
  const handleClearAll = useCallback(() => {
    if (isLocked) return;
    if (favoriteChampions.length > 0) {
      favoriteChampions.forEach(c => skinManager.removeFavorite(c.id));
    }
  }, [favoriteChampions, isLocked]);

  // [STATS] Calculate stats
  const stats = useMemo(() => {
    const withSkins = favoriteChampions.filter(c => 
      skinManager.getSelectedSkin(c.id) !== null
    ).length;
    return { total: favoriteChampions.length, withSkins };
  }, [favoriteChampions, selectionVersion]);

  return (
    <div className="favorites-screen">
      {/* [HEADER] Page header */}
      <div className="favorites-header">
        <h1 className="favorites-title">{t('favorites.title')}</h1>
        <p className="favorites-subtitle">{t('favorites.subtitle')}</p>
      </div>

      {/* [STATS] Stats bar */}
      <div className="favorites-stats">
        <div className="stats-left">
          <div className="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">{t('favorites.total')}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            <span className="stat-value">{stats.withSkins}</span>
            <span className="stat-label">{t('favorites.withSkins')}</span>
          </div>
        </div>
        {favoriteChampions.length > 0 && (
          <div className="stats-right">
            <button className="clear-all-btn" onClick={handleClearAll}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              {t('favorites.clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* [CONTENT] Main content */}
      <div className="favorites-content">
        {isLoading ? (
          <div className="favorites-loading">
            <div className="loading-spinner" />
          </div>
        ) : favoriteChampions.length === 0 ? (
          <div className="favorites-empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h2 className="empty-title">{t('favorites.emptyTitle')}</h2>
            <p className="empty-desc">{t('favorites.emptyDesc')}</p>
          </div>
        ) : (
          <div className="favorites-grid">
            {favoriteChampions.map(champion => (
              <ChampionCard
                key={champion.id}
                champion={champion}
                onClick={handleChampionClick}
                isSelected={selectedChampion?.id === champion.id}
                selectionVersion={selectionVersion}
                isLocked={isLocked}
              />
            ))}
          </div>
        )}
      </div>

      {/* [MODAL] Skin selector */}
      {selectedChampion && (
        <SkinSelector
          champion={selectedChampion}
          onClose={() => setSelectedChampion(null)}
        />
      )}
    </div>
  );
};

export default FavoritesScreen;

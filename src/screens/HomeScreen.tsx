/**
 * File: HomeScreen.tsx
 * Author: Wildflover
 * Description: Main home screen - receives preloaded data from App.tsx
 * Language: TypeScript/React
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChampionFilter, ChampionFull } from "../types";
import { skinService } from "../services/api";
import { skinManager } from "../services/skinManager";
import ChampionCard from "../components/ChampionCard";
import SkinSelector from "../components/SkinSelector";
import "./HomeScreen.css";

// [PROPS] Component props interface
interface HomeScreenProps {
  champions: ChampionFull[];
  onChampionsUpdate: (champions: ChampionFull[]) => void;
  isDataReady: boolean;
  isLocked?: boolean;  // When overlay is active, disable selection
}

const HomeScreen = ({ champions, onChampionsUpdate, isDataReady, isLocked = false }: HomeScreenProps) => {
  const { t, i18n } = useTranslation();
  const [selectedChampion, setSelectedChampion] = useState<ChampionFull | null>(null);
  const [filter, setFilter] = useState<ChampionFilter>({
    searchQuery: "",
    role: "all",
    sortBy: "name"
  });

  // [STATE] Stats
  const [stats, setStats] = useState(() => ({
    totalChampions: 0,
    totalSkins: 0,
    favorites: skinManager.getFavorites().length
  }));
  
  // [STATE] Selection version for card updates
  const [selectionVersion, setSelectionVersion] = useState(0);
  
  // [STATE] Animated stats
  const [animatedStats, setAnimatedStats] = useState({ totalChampions: 0, totalSkins: 0 });

  // [EFFECT] Listen for skin selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      setSelectionVersion(v => v + 1);
      setStats(prev => ({
        ...prev,
        favorites: skinManager.getFavorites().length
      }));
    };
    
    skinManager.addChangeListener(handleSelectionChange);
    return () => skinManager.removeChangeListener(handleSelectionChange);
  }, []);

  // [EFFECT] Update stats when champions change
  useEffect(() => {
    const totalSkins = champions.reduce((sum, c) => sum + c.skins.length, 0);
    setStats(prev => ({
      ...prev,
      totalChampions: champions.length,
      totalSkins
    }));
  }, [champions]);

  // [EFFECT] Animate stats counter
  useEffect(() => {
    if (stats.totalChampions === 0) return;
    
    const duration = 600;
    const startTime = performance.now();
    const startChampions = animatedStats.totalChampions;
    const startSkins = animatedStats.totalSkins;
    
    const animate = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedStats({
        totalChampions: Math.round(startChampions + (stats.totalChampions - startChampions) * eased),
        totalSkins: Math.round(startSkins + (stats.totalSkins - startSkins) * eased)
      });
      
      if (progress < 1) requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [stats.totalChampions, stats.totalSkins]);

  // [MEMO] Filter and sort champions
  const filteredChampions = useMemo(() => {
    let result = [...champions];

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query)
      );
    }

    switch (filter.sortBy) {
      case "name":
        result.sort((a, b) => a.key.localeCompare(b.key, 'en'));
        break;
      case "favorite":
        result.sort((a, b) => {
          const aFav = skinManager.isFavorite(a.id) ? 0 : 1;
          const bFav = skinManager.isFavorite(b.id) ? 0 : 1;
          return aFav - bFav || a.key.localeCompare(b.key, 'en');
        });
        break;
    }

    return result;
  }, [filter, champions]);

  // [HANDLER] Champion click - disabled when overlay is active
  const handleChampionClick = useCallback(async (champion: ChampionFull) => {
    // [LOCK] Prevent selection when overlay is active
    if (isLocked) {
      console.log('[HOME-SCREEN] Selection locked - overlay active');
      return;
    }
    
    if (champion.skins.length === 0) {
      const skins = await skinService.fetchSkins(champion.id);
      const baseSkin = skins.find(s => s.isBase) || skins[0];
      const updated = { ...champion, skins, splashUrl: baseSkin?.splashPath || champion.splashUrl };
      
      onChampionsUpdate(champions.map(c => c.id === champion.id ? updated : c));
      setSelectedChampion(updated);
    } else {
      setSelectedChampion(champion);
    }
  }, [champions, onChampionsUpdate, isLocked]);

  // [HANDLER] Search change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(prev => ({ ...prev, searchQuery: e.target.value }));
  }, []);

  // [HANDLER] Clear search
  const handleClearSearch = useCallback(() => {
    setFilter(prev => ({ ...prev, searchQuery: "" }));
  }, []);

  // [MEMO] Stat cards data
  const statCards = useMemo(() => [
    { 
      label: t('stats.champions'),
      value: animatedStats.totalChampions.toString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    { 
      label: t('stats.totalSkins'),
      value: animatedStats.totalSkins.toString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      )
    },
    { 
      label: t('stats.favorites'),
      value: stats.favorites.toString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )
    }
  ], [t, stats, animatedStats]);

  return (
    <div className="home-screen">
      <div className="home-header">
        <h1 className="home-title" style={{ 
          background: 'linear-gradient(135deg, #ffb3d9 0%, #c94b7c 50%, #ff69b4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>{t('home.title')}</h1>
        <p className="home-subtitle">{t('home.subtitle')}</p>
      </div>

      <div className="stats-section">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="champions-section">
        <div className="section-header">
          <h2 className="section-title">{t('nav.champions')}</h2>
          
          {/* [SEARCH] Compact anime-style search input */}
          <div className={`search-fab ${filter.searchQuery ? 'search-fab-active' : ''}`}>
            <div className="search-fab-glow" />
            <div className="search-fab-border" />
            <div className="search-fab-inner">
              <div className="search-fab-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="7"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
              </div>
              <input
                type="text"
                className="search-fab-input"
                placeholder={t('home.searchPlaceholder')}
                value={filter.searchQuery}
                onChange={handleSearchChange}
              />
              {filter.searchQuery && (
                <button className="search-fab-clear" onClick={handleClearSearch}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <span className="section-count">{filteredChampions.length} {t('home.found')}</span>
        </div>

        {!isDataReady ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p className="loading-text">{t('home.loading')}</p>
          </div>
        ) : (
          <div className="champions-grid">
            {filteredChampions.map((champion) => (
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

      {selectedChampion && (
        <SkinSelector
          champion={selectedChampion}
          onClose={() => setSelectedChampion(null)}
        />
      )}
    </div>
  );
};

export default HomeScreen;

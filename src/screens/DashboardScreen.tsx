/**
 * File: DashboardScreen.tsx
 * Author: Wildflover
 * Description: Dashboard screen with PBE and latest patch skins - locale support
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getUpcomingSkins, 
  getLatestPatchSkins, 
  formatRarity,
  setPBELocale,
  updateSkinLocale,
  updateLatestSkinLocale,
  PBESkin, 
  LatestPatchSkin 
} from '../services/api';
import './DashboardScreen.css';

const DashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const [upcomingSkins, setUpcomingSkins] = useState<PBESkin[]>([]);
  const [latestSkins, setLatestSkins] = useState<LatestPatchSkin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // [REF] Track if initial load completed
  const initialLoadDone = useRef(false);
  const previousLocale = useRef<string>(i18n.language || 'en');

  // [EFFECT] Initial data load - only once on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      setPBELocale(i18n.language || 'en');
      
      try {
        const [pbe, latest] = await Promise.all([
          getUpcomingSkins(),
          getLatestPatchSkins()
        ]);
        
        console.log('[DASHBOARD] PBE skins received:', pbe.length);
        console.log('[DASHBOARD] Latest skins received:', latest.length);
        console.log('[DASHBOARD] Latest skins data:', latest);
        
        setUpcomingSkins(pbe);
        setLatestSkins(latest);
        initialLoadDone.current = true;
        console.log(`[DASHBOARD] Loaded ${pbe.length} PBE, ${latest.length} latest skins`);
      } catch (err) {
        console.error('[DASHBOARD] Load failed:', err);
        setError(t('dashboard.error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t, i18n.language]);

  // [EFFECT] Update names only when language changes - no full reload
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (previousLocale.current === i18n.language) return;
    
    const updateNames = async () => {
      console.log(`[DASHBOARD] Updating locale: ${previousLocale.current} -> ${i18n.language}`);
      setPBELocale(i18n.language || 'en');
      previousLocale.current = i18n.language;
      
      // Update names without showing loading state
      if (upcomingSkins.length > 0) {
        const updatedPBE = await updateSkinLocale(upcomingSkins);
        setUpcomingSkins(updatedPBE);
      }
      
      if (latestSkins.length > 0) {
        const updatedLatest = await updateLatestSkinLocale(latestSkins);
        setLatestSkins(updatedLatest);
      }
    };

    updateNames();
  }, [i18n.language, upcomingSkins.length, latestSkins.length]);

  // [RENDER] Skin card component
  const renderSkinCard = useCallback((skin: PBESkin | LatestPatchSkin, isPBE: boolean = false) => {
    const hasRarity = skin.rarity && skin.rarity !== 'kNoRarity';
    const rarityName = formatRarity(skin.rarity);
    
    return (
      <div key={skin.id} className="skin-card">
        <div className="skin-card-image">
          <img 
            src={skin.splashPath || skin.loadScreenPath} 
            alt={skin.name}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== skin.loadScreenPath) {
                target.src = skin.loadScreenPath;
              }
            }}
          />
          <div className="skin-card-gradient" />
          {isPBE && <span className="skin-badge-pbe">PBE</span>}
          {hasRarity && (
            <span className={`skin-rarity-text rarity-${rarityName.toLowerCase()}`}>
              {rarityName}
            </span>
          )}
        </div>
        <div className="skin-card-content">
          <span className="skin-card-champion">{skin.championName}</span>
          <h3 className="skin-card-name">{skin.name}</h3>
          <div className="skin-card-meta">
            {skin.skinLine && (
              <span className="skin-card-line">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                {skin.skinLine}
              </span>
            )}
            <span className="skin-card-price">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v12M8 10h8M8 14h8"/>
              </svg>
              {skin.estimatedPrice}
            </span>
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <div className="dashboard-screen">
      <div className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.title')}</h1>
        <p className="dashboard-subtitle">{t('dashboard.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>{t('dashboard.loading')}</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>{t('dashboard.retry')}</button>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* [SECTION] Upcoming PBE Skins */}
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-title-group">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <h2 className="section-title">{t('dashboard.upcoming')}</h2>
              </div>
              <span className="section-count">{upcomingSkins.length} {t('dashboard.skins')}</span>
            </div>

            {upcomingSkins.length === 0 ? (
              <div className="dashboard-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 15h8M9 9h.01M15 9h.01"/>
                </svg>
                <p>{t('dashboard.noSkins')}</p>
              </div>
            ) : (
              <div className="skins-grid">
                {upcomingSkins.map(skin => renderSkinCard(skin, true))}
              </div>
            )}
          </section>

          {/* [SECTION] Latest Patch Skins */}
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-title-group">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                <h2 className="section-title">
                  {t('dashboard.latestPatch')} 
                  {latestSkins[0]?.patchVersion && latestSkins[0].patchVersion !== 'Latest' && (
                    <span className="patch-version">{latestSkins[0].patchVersion}</span>
                  )}
                </h2>
              </div>
              <span className="section-count">{latestSkins.length} {t('dashboard.skins')}</span>
            </div>

            {latestSkins.length === 0 ? (
              <div className="dashboard-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 15h8M9 9h.01M15 9h.01"/>
                </svg>
                <p>{t('dashboard.noSkins')}</p>
              </div>
            ) : (
              <div className="skins-grid">
                {latestSkins.map(skin => renderSkinCard(skin, false))}
              </div>
            )}
          </section>

          {/* [INFO] Info banner */}
          <div className="dashboard-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>{t('dashboard.infoText')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;

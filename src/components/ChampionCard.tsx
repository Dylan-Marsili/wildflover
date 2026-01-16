/**
 * File: ChampionCard.tsx
 * Author: Wildflover
 * Description: Champion card component with memoization and optimized event handlers
 * Language: TypeScript/React
 */

import { useState, useRef, memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChampionFull } from '../types';
import { skinManager } from '../services/skinManager';
import './ChampionCard.css';

// [PROPS] Component property definitions
interface ChampionCardProps {
  champion: ChampionFull;
  onClick: (champion: ChampionFull) => void;
  isSelected?: boolean;
  isResetting?: boolean;
  selectionVersion?: number;
  isLocked?: boolean;  // When overlay is active, show locked state
}

// [COMPONENT] Memoized champion card for render optimization
const ChampionCard = memo(({ champion, onClick, isSelected, isResetting, selectionVersion, isLocked = false }: ChampionCardProps) => {
  const { t } = useTranslation();
  const [isFavorite, setIsFavorite] = useState(() => skinManager.isFavorite(champion.id));
  
  // [STATE] Image loading state for smooth transitions
  const [skinImageLoaded, setSkinImageLoaded] = useState(false);
  
  // [COMPUTED] Skin selection data - recomputed when selectionVersion changes
  const selectionData = useMemo(() => {
    const selectedSkin = skinManager.getSelectedSkin(champion.id);
    const selectedSkinData = selectedSkin ? champion.skins.find(s => s.id === selectedSkin) : null;
    const hasCustomSkin = selectedSkinData && selectedSkinData.id !== champion.skins[0]?.id;
    
    const selectedChroma = skinManager.getSelectedChroma(champion.id);
    const hasChroma = selectedChroma && selectedChroma.skinId === selectedSkin;
    
    const selectedForm = skinManager.getSelectedForm(champion.id);
    const hasForm = selectedForm && selectedForm.skinId === selectedSkin;
    const selectedFormData = hasForm && selectedSkinData 
      ? selectedSkinData.forms?.find(f => f.id === selectedForm.formId) 
      : null;
    
    return {
      selectedSkin,
      selectedSkinData,
      hasCustomSkin,
      selectedChroma,
      hasChroma,
      selectedForm,
      hasForm,
      selectedFormData
    };
  }, [champion.id, champion.skins, selectionVersion]);
  
  const { selectedSkinData, hasCustomSkin, selectedChroma, hasChroma, selectedFormData, hasForm } = selectionData;
  
  // [REF] Track custom skin, chroma and form state for synchronized fade-out
  const hadCustomRef = useRef(hasCustomSkin);
  const hadChromaRef = useRef(hasChroma);
  const hadFormRef = useRef(hasForm);
  const cachedImgRef = useRef(selectedSkinData?.loadScreenPath || '');
  const cachedSkinNameRef = useRef(selectedSkinData?.name || '');
  const cachedChromaRef = useRef<{ name: string; colors: string[] } | null>(null);
  const cachedFormRef = useRef<{ name: string; splashPath: string } | null>(null);
  
  // [CACHE] Update cache when skin/chroma/form changes (not during reset)
  if (!isResetting && hasCustomSkin && selectedSkinData) {
    hadCustomRef.current = true;
    // Use form splash if form is selected, otherwise use skin splash
    cachedImgRef.current = selectedFormData?.splashPath || selectedSkinData.splashPath || selectedSkinData.loadScreenPath;
    cachedSkinNameRef.current = selectedFormData?.name || selectedSkinData.name;
  }
  
  // [CACHE] Cache chroma data for fade-out
  if (!isResetting && hasChroma && selectedChroma) {
    hadChromaRef.current = true;
    const rawName = selectedChroma.chromaName;
    const parsedName = rawName.match(/\(([^)]+)\)$/)?.[1] || rawName;
    cachedChromaRef.current = {
      name: parsedName,
      colors: selectedChroma.colors || []
    };
  }
  
  // [CACHE] Cache form data for fade-out
  if (!isResetting && hasForm && selectedFormData) {
    hadFormRef.current = true;
    cachedFormRef.current = {
      name: selectedFormData.name,
      splashPath: selectedFormData.splashPath
    };
  }
  
  // [ANIMATION] Fade-out state calculation - synchronized for all elements
  const showFadeOut = isResetting && hadCustomRef.current;
  const showChromaFadeOut = isResetting && hadChromaRef.current;
  
  // [CLEANUP] Clear refs after reset completes
  if (!isResetting && !hasCustomSkin) {
    hadCustomRef.current = false;
    cachedSkinNameRef.current = '';
  }
  if (!isResetting && !hasChroma) {
    hadChromaRef.current = false;
    cachedChromaRef.current = null;
  }
  if (!isResetting && !hasForm) {
    hadFormRef.current = false;
    cachedFormRef.current = null;
  }

  // [HANDLER] Favorite toggle with event propagation stop
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(prev => {
      const newState = !prev;
      if (newState) {
        skinManager.addFavorite(champion.id);
      } else {
        skinManager.removeFavorite(champion.id);
      }
      return newState;
    });
  }, [champion.id]);

  // [HANDLER] Card click handler
  const handleCardClick = useCallback(() => {
    onClick(champion);
  }, [onClick, champion]);

  // [RENDER] Image source computation - Use splash art as default
  const defaultImg = champion.splashUrl || champion.skins[0]?.splashPath || champion.iconUrl || '';
  
  // [FORM-AWARE] Use form splash if form is selected
  const skinSplash = selectedFormData?.splashPath || selectedSkinData?.splashPath || selectedSkinData?.loadScreenPath;
  const activeImg = skinSplash || defaultImg;
  
  // [EFFECT] Reset loading state when skin image changes
  useEffect(() => {
    if (activeImg && activeImg !== defaultImg) {
      setSkinImageLoaded(false);
    }
  }, [activeImg, defaultImg]);
  
  // [HANDLER] Skin image load complete
  const handleSkinImageLoad = useCallback(() => {
    setSkinImageLoaded(true);
  }, []);
  
  const showIndicator = hasCustomSkin || showFadeOut;
  const skinCount = champion.skins.length || 0;
  
  // [COMPUTED] Display name - Show form name if selected, then skin name, use cached during fade-out
  const displayName = useMemo(() => {
    if (showFadeOut) return cachedSkinNameRef.current || champion.name;
    if (hasForm && selectedFormData) return selectedFormData.name;
    if (hasCustomSkin && selectedSkinData) return selectedSkinData.name;
    return champion.name;
  }, [showFadeOut, hasForm, selectedFormData, hasCustomSkin, selectedSkinData, champion.name]);
  
  // [COMPUTED] Chroma indicator data - memoized for performance
  const chromaDisplayData = useMemo(() => {
    const showChromaBadge = hasChroma || showChromaFadeOut;
    
    if (!showChromaBadge) return { showChromaBadge: false, chromaDisplayName: null, chromaColors: [] };
    
    if (showChromaFadeOut) {
      return {
        showChromaBadge: true,
        chromaDisplayName: cachedChromaRef.current?.name,
        chromaColors: cachedChromaRef.current?.colors || []
      };
    }
    
    const currentChromaData = hasChroma && selectedSkinData && selectedChroma
      ? selectedSkinData.chromas.find(c => c.id === selectedChroma.chromaId)
      : null;
    
    const chromaDisplayName = currentChromaData 
      ? (currentChromaData.name.match(/\(([^)]+)\)$/)?.[1] || currentChromaData.name)
      : (hasChroma && selectedChroma 
          ? (selectedChroma.chromaName.match(/\(([^)]+)\)$/)?.[1] || selectedChroma.chromaName)
          : null);
    
    const chromaColors = currentChromaData?.colors || (hasChroma && selectedChroma?.colors ? selectedChroma.colors : []);
    
    return { showChromaBadge, chromaDisplayName, chromaColors };
  }, [hasChroma, showChromaFadeOut, selectedSkinData, selectedChroma]);
  
  const { showChromaBadge, chromaDisplayName, chromaColors } = chromaDisplayData;

  return (
    <div 
      className={`champion-card ${isSelected ? 'selected' : ''} ${hasChroma ? 'has-chroma' : ''} ${isLocked ? 'locked' : ''}`}
      onClick={handleCardClick}
    >
      <div className="card-glow" />

      <div className="card-image-wrapper">
        <img 
          src={defaultImg} 
          alt={champion.name} 
          className="card-image" 
          decoding="async"
        />
        
        {(hasCustomSkin || showFadeOut) && (
          <img 
            src={showFadeOut ? cachedImgRef.current : activeImg}
            alt={champion.name}
            className={`card-image card-skin-overlay ${showFadeOut ? 'fade-out' : ''} ${skinImageLoaded ? 'loaded' : ''}`}
            onLoad={handleSkinImageLoad}
            decoding="async"
          />
        )}
        
        {/* [LOCK] Overlay lock indicator when mods are active */}
        {isLocked && (
          <div className="card-lock-overlay">
            <svg className="lock-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
        )}
      </div>

      <div className="card-overlay" />
      
      {showIndicator && <div className={`card-skin-indicator ${showFadeOut ? 'fade-out' : ''}`} />}

      <button className={`card-favorite ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteClick}>
        <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </button>

      <div className="card-skin-count">
        <div className="skin-count-inner">
          <span className="skin-count-value">{skinCount}</span>
          <span className="skin-count-label">{t('skinSelector.skins')}</span>
        </div>
      </div>

      <div className="card-content">
        <h3 className="card-name">{displayName}</h3>
        <p className="card-title">{champion.title}</p>
        
        {/* [CHROMA-BADGE] Enhanced chroma indicator with synchronized fade-out */}
        {showChromaBadge && chromaDisplayName && (
          <div className={`card-chroma-badge ${showChromaFadeOut ? 'fade-out' : ''}`}>
            {chromaColors.length > 0 && (
              <div className="chroma-badge-colors">
                <span 
                  className="chroma-color-dot chroma-gradient-dot"
                  style={{ 
                    background: chromaColors.length === 1 
                      ? chromaColors[0]
                      : `linear-gradient(135deg, ${[...new Set(chromaColors)].join(', ')})`,
                    boxShadow: `0 0 8px ${chromaColors[0]}`
                  }}
                />
              </div>
            )}
            <span className="chroma-badge-name">{chromaDisplayName}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChampionCard;

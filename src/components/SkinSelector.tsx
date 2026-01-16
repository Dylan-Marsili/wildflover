/**
 * File: SkinSelector.tsx
 * Author: Wildflover
 * Description: Modal component for skin selection with chroma preview system
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChampionFull, SkinData, ChromaData, SkinFormData } from '../types';
import { skinManager } from '../services/skinManager';
import { buildRarityGemUrl } from '../services/api';
import { discordRpc } from '../services/discord/rpc';
import { imagePreloader } from '../services/imagePreloader';
import './SkinSelector.css';

// [INTERFACE] Chroma preview tooltip position state
interface ChromaPreviewState {
  visible: boolean;
  chroma: ChromaData | null;
  x: number;
  y: number;
}

// [INTERFACE] Form preview tooltip position state
interface FormPreviewState {
  visible: boolean;
  form: SkinFormData | null;
  x: number;
  y: number;
}

interface SkinSelectorProps {
  champion: ChampionFull;
  onClose: () => void;
  isLocked?: boolean;  // When overlay is active, disable select/reset buttons
}

// [COMPONENT] Rarity gem icon for preview section
const RarityGem = memo(({ rarity }: { rarity: string }) => {
  if (rarity === 'kNoRarity') return null;
  return (
    <img 
      src={buildRarityGemUrl(rarity)} 
      alt={rarity.replace('k', '')} 
      className="rarity-gem-icon"
      loading="lazy"
    />
  );
});

// [HELPER] Get rarity class name for border styling
const getRarityClass = (rarity: string): string => {
  if (rarity === 'kNoRarity') return '';
  return `rarity-${rarity.replace('k', '').toLowerCase()}`;
};

// [HELPER] Generate gradient style for chroma based on color count
const getChromaGradientStyle = (colors: string[]): React.CSSProperties => {
  if (!colors || colors.length === 0) {
    return {
      '--chroma-color': '#ff69b4',
      '--chroma-secondary': '#ba55d3',
      '--chroma-gradient': 'radial-gradient(circle at 30% 30%, #ff69b4 0%, #ba55d3 100%)',
    } as React.CSSProperties;
  }

  const primary = colors[0];
  const secondary = colors[1] || primary;
  const tertiary = colors[2] || secondary;

  // [GRADIENT-LOGIC] Create radial gradient for circular appearance
  let gradient: string;
  if (colors.length === 1) {
    gradient = `radial-gradient(circle at 30% 30%, ${primary} 0%, ${primary} 100%)`;
  } else if (colors.length === 2) {
    gradient = `radial-gradient(circle at 30% 30%, ${primary} 0%, ${secondary} 100%)`;
  } else {
    gradient = `radial-gradient(circle at 30% 30%, ${primary} 0%, ${secondary} 50%, ${tertiary} 100%)`;
  }

  return {
    '--chroma-color': primary,
    '--chroma-secondary': secondary,
    '--chroma-tertiary': tertiary,
    '--chroma-gradient': gradient,
  } as React.CSSProperties;
};

const SkinSelector = memo(({ champion, onClose, isLocked = false }: SkinSelectorProps) => {
  const { t } = useTranslation();
  // [STATE] Temporary selection state - only saved on Done click
  const [tempSelectedSkin, setTempSelectedSkin] = useState<SkinData | null>(null);
  const [tempSelectedChroma, setTempSelectedChroma] = useState<ChromaData | null>(null);
  const [tempSelectedForm, setTempSelectedForm] = useState<SkinFormData | null>(null);
  const [previewSkin, setPreviewSkin] = useState<SkinData>(champion.skins[0]);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  // [STATE] Chroma preview tooltip state
  const [chromaPreview, setChromaPreview] = useState<ChromaPreviewState>({
    visible: false,
    chroma: null,
    x: 0,
    y: 0,
  });
  
  // [STATE] Form preview tooltip state
  const [formPreview, setFormPreview] = useState<FormPreviewState>({
    visible: false,
    form: null,
    x: 0,
    y: 0,
  });
  
  const previewTimeoutRef = useRef<number | null>(null);
  const formPreviewTimeoutRef = useRef<number | null>(null);
  const skinListRef = useRef<HTMLDivElement>(null);
  const selectedSkinRef = useRef<HTMLDivElement>(null);

  // [HANDLER] Image load callback - must be defined before preload effect
  const handleImageLoad = useCallback((url: string) => {
    setLoadedImages(prev => new Set(prev).add(url));
  }, []);

  // [INIT] Load current saved selection on mount and check preloader
  useEffect(() => {
    const currentSkinId = skinManager.getSelectedSkin(champion.id);
    const currentChroma = skinManager.getSelectedChroma(champion.id);
    const currentForm = skinManager.getSelectedForm(champion.id);
    
    if (currentSkinId) {
      const skin = champion.skins.find(s => s.id === currentSkinId);
      if (skin) {
        setTempSelectedSkin(skin);
        setPreviewSkin(skin);
        
        // [RESTORE] Restore chroma selection if exists
        if (currentChroma && currentChroma.skinId === currentSkinId) {
          const chroma = skin.chromas.find(c => c.id === currentChroma.chromaId);
          if (chroma) {
            setTempSelectedChroma(chroma);
          }
        }
        
        // [RESTORE] Restore form selection if exists
        if (currentForm && currentForm.skinId === currentSkinId) {
          const form = skin.forms.find(f => f.id === currentForm.formId);
          if (form) {
            setTempSelectedForm(form);
          }
        }
      }
    }
    
    // [PRELOAD-CHECK] Mark already loaded images from preloader cache
    champion.skins.forEach(skin => {
      if (imagePreloader.isLoaded(skin.splashPath)) {
        setLoadedImages(prev => new Set(prev).add(skin.splashPath));
      }
      if (imagePreloader.isLoaded(skin.loadScreenPath)) {
        setLoadedImages(prev => new Set(prev).add(skin.loadScreenPath));
      }
    });
    
    // [PRIORITY-PRELOAD] If not in cache, preload this champion's images immediately
    if (!imagePreloader.getStatus().isComplete) {
      imagePreloader.preloadChampion(champion);
    }
  }, [champion]);

  // [RPC] Update Discord RPC when skin selector opens
  useEffect(() => {
    discordRpc.setPage('SKIN_SELECTOR', champion.name);
    
    // Restore RPC to HOME when modal closes
    return () => {
      discordRpc.setPage('HOME');
    };
  }, [champion.name]);

  // [SCROLL] Scroll to selected skin after selection is restored
  useEffect(() => {
    // Wait for next frame to ensure refs are set
    const timeoutId = setTimeout(() => {
      if (selectedSkinRef.current && skinListRef.current) {
        const listRect = skinListRef.current.getBoundingClientRect();
        const itemRect = selectedSkinRef.current.getBoundingClientRect();
        const scrollOffset = itemRect.top - listRect.top - (listRect.height / 2) + (itemRect.height / 2);
        
        skinListRef.current.scrollTo({
          top: skinListRef.current.scrollTop + scrollOffset,
          behavior: 'instant'
        });
      }
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [tempSelectedSkin]);

  // [PRELOAD] Check preloader cache when preview skin changes
  useEffect(() => {
    // Check if splash is already in preloader cache
    if (imagePreloader.isLoaded(previewSkin.splashPath)) {
      handleImageLoad(previewSkin.splashPath);
    } else {
      // Not in cache, preload manually
      const previewImg = new Image();
      previewImg.src = previewSkin.splashPath;
      previewImg.onload = () => handleImageLoad(previewSkin.splashPath);
    }
    
    // Preload chromas if not in cache
    if (previewSkin.chromas && previewSkin.chromas.length > 0) {
      previewSkin.chromas.forEach(chroma => {
        if (chroma.chromaPath && !imagePreloader.isLoaded(chroma.chromaPath)) {
          const img = new Image();
          img.src = chroma.chromaPath;
        }
      });
    }
    
    // Preload forms if not in cache
    if (previewSkin.forms && previewSkin.forms.length > 0) {
      previewSkin.forms.forEach(form => {
        if (form.splashPath && !imagePreloader.isLoaded(form.splashPath)) {
          const img = new Image();
          img.src = form.splashPath;
        }
      });
    }
  }, [previewSkin, handleImageLoad]);

  // [HANDLER] Skin selection - temporary only, also sets preview
  const handleSkinSelect = useCallback((skin: SkinData) => {
    // [PREVIEW] Always update preview on click
    setPreviewSkin(skin);
    
    const isDefaultSkin = skin.id === champion.skins[0].id;
    if (isDefaultSkin) {
      setTempSelectedSkin(null);
    } else {
      setTempSelectedSkin(skin);
    }
    setTempSelectedChroma(null);
    setTempSelectedForm(null);
  }, [champion]);

  // [HANDLER] Skin click for preview - preload adjacent skins
  const handleSkinPreview = useCallback((skin: SkinData, index: number) => {
    setPreviewSkin(skin);
    
    // [PRELOAD-ADJACENT] Preload next 3 skins for smooth scrolling
    const preloadRange = 3;
    for (let i = 1; i <= preloadRange; i++) {
      const nextIndex = index + i;
      const prevIndex = index - i;
      
      if (nextIndex < champion.skins.length) {
        const nextSkin = champion.skins[nextIndex];
        const img = new Image();
        img.src = nextSkin.splashPath;
      }
      if (prevIndex >= 0) {
        const prevSkin = champion.skins[prevIndex];
        const img = new Image();
        img.src = prevSkin.splashPath;
      }
    }
  }, [champion.skins]);

  // [HANDLER] Chroma selection - temporary only
  const handleChromaSelect = useCallback((chroma: ChromaData) => {
    const newChroma = tempSelectedChroma?.id === chroma.id ? null : chroma;
    setTempSelectedChroma(newChroma);
    // [BEHAVIOR] Hide preview tooltip on click
    setChromaPreview(prev => ({ ...prev, visible: false }));
    
    // [AUTO-SELECT] Auto-select skin when chroma is selected
    if (newChroma && previewSkin && previewSkin.id !== champion.skins[0].id) {
      if (!tempSelectedSkin || tempSelectedSkin.id !== previewSkin.id) {
        setTempSelectedSkin(previewSkin);
      }
    }
  }, [champion.skins, tempSelectedChroma, tempSelectedSkin, previewSkin]);

  // [HANDLER] Chroma hover - show mini preview tooltip with boundary check
  const handleChromaHover = useCallback((chroma: ChromaData, event: React.MouseEvent) => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipWidth = 180;
    const tooltipHalfWidth = tooltipWidth / 2;
    const padding = 12;
    
    // [BOUNDARY] Calculate X position with screen boundary check
    let xPos = rect.left + rect.width / 2;
    
    // Check left boundary
    if (xPos - tooltipHalfWidth < padding) {
      xPos = tooltipHalfWidth + padding;
    }
    // Check right boundary
    if (xPos + tooltipHalfWidth > window.innerWidth - padding) {
      xPos = window.innerWidth - tooltipHalfWidth - padding;
    }
    
    previewTimeoutRef.current = window.setTimeout(() => {
      setChromaPreview({
        visible: true,
        chroma,
        x: xPos,
        y: rect.top - 10,
      });
    }, 180);
  }, []);

  // [HANDLER] Chroma leave - hide preview tooltip
  const handleChromaLeave = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setChromaPreview(prev => ({ ...prev, visible: false }));
  }, []);

  // [HANDLER] Form selection - for tiered skins
  const handleFormSelect = useCallback((form: SkinFormData) => {
    const newForm = tempSelectedForm?.id === form.id ? null : form;
    setTempSelectedForm(newForm);
    // [BEHAVIOR] Hide preview tooltip on click
    setFormPreview(prev => ({ ...prev, visible: false }));
    
    // [AUTO-SELECT] Auto-select skin when form is selected
    if (newForm && previewSkin && previewSkin.id !== champion.skins[0].id) {
      if (!tempSelectedSkin || tempSelectedSkin.id !== previewSkin.id) {
        setTempSelectedSkin(previewSkin);
      }
    }
  }, [champion.skins, tempSelectedForm, tempSelectedSkin, previewSkin]);

  // [HANDLER] Form hover - show preview tooltip
  const handleFormHover = useCallback((form: SkinFormData, event: React.MouseEvent) => {
    if (formPreviewTimeoutRef.current) {
      clearTimeout(formPreviewTimeoutRef.current);
    }
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipWidth = 200;
    const tooltipHalfWidth = tooltipWidth / 2;
    const padding = 12;
    
    // [BOUNDARY] Calculate X position with screen boundary check
    let xPos = rect.left + rect.width / 2;
    
    if (xPos - tooltipHalfWidth < padding) {
      xPos = tooltipHalfWidth + padding;
    }
    if (xPos + tooltipHalfWidth > window.innerWidth - padding) {
      xPos = window.innerWidth - tooltipHalfWidth - padding;
    }
    
    formPreviewTimeoutRef.current = window.setTimeout(() => {
      setFormPreview({
        visible: true,
        form,
        x: xPos,
        y: rect.top - 10,
      });
    }, 200);
  }, []);

  // [HANDLER] Form leave - hide preview tooltip
  const handleFormLeave = useCallback(() => {
    if (formPreviewTimeoutRef.current) {
      clearTimeout(formPreviewTimeoutRef.current);
      formPreviewTimeoutRef.current = null;
    }
    setFormPreview(prev => ({ ...prev, visible: false }));
  }, []);

  // [HANDLER] Reset - clear temporary selections and saved selection
  const handleReset = useCallback(() => {
    if (isLocked) return;  // [LOCK] Prevent reset when overlay active
    setTempSelectedSkin(null);
    setTempSelectedChroma(null);
    setTempSelectedForm(null);
    setPreviewSkin(champion.skins[0]);
    
    // [IMMEDIATE] Clear saved selection immediately
    skinManager.clearSkinSelection(champion.id);
    
    // [CLOSE] Close modal after reset
    onClose();
  }, [champion, onClose, isLocked]);

  // [HANDLER] Done - save selections and close
  const handleDone = useCallback(() => {
    if (isLocked) return;  // [LOCK] Prevent selection when overlay active
    
    // Clear previous selections first
    skinManager.clearSkinSelection(champion.id);
    
    // Save skin selection
    if (tempSelectedSkin) {
      skinManager.selectSkinById(champion.id, tempSelectedSkin.id);
      
      // Save chroma selection if exists
      if (tempSelectedChroma) {
        skinManager.selectChroma(
          champion.id,
          tempSelectedChroma.id,
          tempSelectedChroma.name,
          tempSelectedSkin.id,
          tempSelectedSkin.name,
          tempSelectedChroma.colors || []
        );
      }
      
      // Save form selection if exists
      if (tempSelectedForm) {
        skinManager.selectForm(
          champion.id,
          tempSelectedForm.id,
          tempSelectedForm.name,
          tempSelectedForm.stage,
          tempSelectedSkin.id,
          tempSelectedSkin.name
        );
      }
    }
    
    onClose();
  }, [champion.id, tempSelectedSkin, tempSelectedChroma, tempSelectedForm, onClose, isLocked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // [COMPUTED] Current preview image - show form splash if selected, otherwise skin splash
  const currentPreviewImage = useMemo(() => {
    if (tempSelectedForm && tempSelectedSkin?.id === previewSkin.id) {
      return tempSelectedForm.splashPath;
    }
    return previewSkin.splashPath;
  }, [previewSkin, tempSelectedForm, tempSelectedSkin]);

  const isImageLoaded = useMemo(() => 
    loadedImages.has(currentPreviewImage), 
    [loadedImages, currentPreviewImage]
  );

  // [COMPUTED] Current preview name
  const currentPreviewName = useMemo(() => {
    if (tempSelectedForm && tempSelectedSkin?.id === previewSkin.id) {
      return tempSelectedForm.name;
    }
    if (tempSelectedChroma && tempSelectedSkin?.id === previewSkin.id) {
      return tempSelectedChroma.name;
    }
    return previewSkin.name;
  }, [tempSelectedChroma, tempSelectedForm, tempSelectedSkin, previewSkin]);

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // [PORTAL] Render modal to document body for proper fixed positioning
  const modalContent = (
    <div className="skin-selector-overlay" onClick={onClose}>
      <div className="skin-selector-modal" onClick={handleModalClick}>
        <div className="skin-preview-section">
          <img
            src={currentPreviewImage}
            alt={currentPreviewName}
            className={`skin-preview-image ${isImageLoaded ? 'loaded' : ''}`}
            onLoad={() => handleImageLoad(currentPreviewImage)}
          />
          <div className="skin-preview-overlay" />
          
          <div className="skin-preview-info">
            <h2 className="preview-champion-name">{champion.name}</h2>
            <span className="preview-champion-title">{champion.title}</span>
          </div>

          <div className="skin-preview-current">
            <span className="current-skin-label">{tempSelectedChroma && tempSelectedSkin?.id === previewSkin.id ? t('skinSelector.chroma') : t('skinSelector.preview')}</span>
            <h3 className="current-skin-name">{currentPreviewName}</h3>
            <div className="skin-badges">
              {previewSkin.rarity !== 'kNoRarity' && (
                <span className={`rarity-badge rarity-${previewSkin.rarity.replace('k', '').toLowerCase()}`}>
                  <RarityGem rarity={previewSkin.rarity} />
                  <span className="rarity-name">{previewSkin.rarity.replace('k', '')}</span>
                </span>
              )}
              {previewSkin.isLegacy && (
                <span className="legacy-badge">{t('skinSelector.legacy')}</span>
              )}
            </div>
            
            {/* [CHROMA-INLINE] Inline chroma selector with preview tooltip */}
            {previewSkin.chromas.length > 0 && (
              <div className="chroma-inline">
                <div className="chroma-inline-colors">
                  {previewSkin.chromas.map((chroma) => {
                    const isActive = tempSelectedChroma?.id === chroma.id && tempSelectedSkin?.id === previewSkin.id;
                    const gradientStyle = getChromaGradientStyle(chroma.colors);
                    return (
                      <button
                        key={chroma.id}
                        className={`chroma-dot ${isActive ? 'active' : ''} ${chroma.colors.length > 2 ? 'multi-color' : ''}`}
                        onClick={() => handleChromaSelect(chroma)}
                        onMouseEnter={(e) => handleChromaHover(chroma, e)}
                        onMouseLeave={handleChromaLeave}
                        style={gradientStyle}
                      >
                        <span className="chroma-check">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* [FORM-SELECTOR] Tiered skin form selector */}
            {previewSkin.forms && previewSkin.forms.length > 0 && (
              <div className="form-selector">
                <span className="form-selector-label">{t('skinSelector.forms')}</span>
                <div className="form-selector-items">
                  {previewSkin.forms.map((form) => {
                    const isActive = tempSelectedForm?.id === form.id && tempSelectedSkin?.id === previewSkin.id;
                    return (
                      <button
                        key={form.id}
                        className={`form-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleFormSelect(form)}
                        onMouseEnter={(e) => handleFormHover(form, e)}
                        onMouseLeave={handleFormLeave}
                      >
                        <img 
                          src={form.loadScreenPath} 
                          alt={form.name}
                          className="form-item-image"
                          loading="lazy"
                        />
                        <span className="form-item-stage">{form.stage}</span>
                        {isActive && (
                          <span className="form-item-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* [CHROMA-PREVIEW-TOOLTIP] Mini preview on hover - Portal rendered */}
          {chromaPreview.visible && chromaPreview.chroma && createPortal(
            <div 
              className="chroma-preview-tooltip"
              style={{
                left: chromaPreview.x,
                top: chromaPreview.y,
                '--preview-accent': chromaPreview.chroma.colors?.[0] || '#ff69b4',
              } as React.CSSProperties}
            >
              <div className="chroma-preview-image-wrapper">
                <img 
                  src={chromaPreview.chroma.chromaPath} 
                  alt={chromaPreview.chroma.name}
                  className="chroma-preview-image"
                />
              </div>
              <div className="chroma-preview-info">
                <div className="chroma-preview-accent-line" />
                <span className="chroma-preview-name">
                  {chromaPreview.chroma.name.match(/\(([^)]+)\)$/)?.[1] || chromaPreview.chroma.name}
                </span>
              </div>
              <div className="chroma-preview-arrow" />
            </div>,
            document.body
          )}

          {/* [FORM-PREVIEW-TOOLTIP] Form preview on hover - Portal rendered */}
          {formPreview.visible && formPreview.form && createPortal(
            <div 
              className="form-preview-tooltip"
              style={{
                left: formPreview.x,
                top: formPreview.y,
              }}
            >
              <div className="form-preview-image-wrapper">
                <img 
                  src={formPreview.form.splashPath} 
                  alt={formPreview.form.name}
                  className="form-preview-image"
                />
                <div className="form-preview-stage-badge">{formPreview.form.stage}</div>
              </div>
              <div className="form-preview-info">
                <div className="form-preview-accent-line" />
                <span className="form-preview-name">{formPreview.form.name}</span>
              </div>
              <div className="form-preview-arrow" />
            </div>,
            document.body
          )}

          <button className="skin-selector-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="skin-list-section">
          <div className="skin-list-header">
            <svg className="skin-list-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <h3 className="skin-list-title">{t('skinSelector.availableSkins')}</h3>
            <span className="skin-list-count">{champion.skins.length} {t('skinSelector.skins')}</span>
          </div>

          <div className="skin-list" ref={skinListRef}>
            {champion.skins.map((skin, index) => {
              const isSelected = tempSelectedSkin?.id === skin.id;
              const rarityClass = getRarityClass(skin.rarity);
              return (
                <div
                  key={skin.id}
                  ref={isSelected ? selectedSkinRef : null}
                  className={`skin-item ${isSelected ? 'selected' : ''} ${previewSkin.id === skin.id ? 'previewing' : ''} ${rarityClass}`}
                  onClick={() => {
                    handleSkinPreview(skin, index);
                    handleSkinSelect(skin);
                  }}
                >
                  {skin.rarity !== 'kNoRarity' && (
                    <div className="skin-item-rarity-gem">
                      <RarityGem rarity={skin.rarity} />
                    </div>
                  )}
                  <div className="skin-item-image-wrapper">
                    <img src={skin.loadScreenPath} alt={skin.name} className="skin-item-image" loading={index < 8 ? 'eager' : 'lazy'} />
                    {isSelected && (
                      <div className="skin-item-selected-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="skin-item-info">
                    <span className="skin-item-name">{skin.name}</span>
                    {skin.chromas.length > 0 && (
                      <span className="skin-item-chroma">+{skin.chromas.length} {t('skinSelector.chroma')}</span>
                    )}
                    {skin.forms && skin.forms.length > 0 && (
                      <span className="skin-item-forms">+{skin.forms.length} {t('skinSelector.form')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="skin-list-actions">
            <button 
              className={`skin-action-btn apply ${isLocked ? 'locked' : ''}`} 
              onClick={handleDone}
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('actions.select')}
            </button>
            <button 
              className={`skin-action-btn reset ${isLocked ? 'locked' : ''}`} 
              onClick={handleReset}
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              {t('actions.reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // [RENDER] Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
});

export default SkinSelector;

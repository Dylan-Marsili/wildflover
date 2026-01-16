/**
 * File: SelectedSkinsModal.tsx
 * Author: Wildflover
 * Description: Modal component displaying selected skins and customs with management options
 * Language: TypeScript/React
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChampionFull } from '../types';
import { skinManager } from '../services/skinManager';
import { customsStorage } from '../services/customsStorage';
import './SelectedSkinsModal.css';

interface SelectedSkinsModalProps {
  champions: ChampionFull[];
  onClose: () => void;
  onResetAll: () => void;
  onChampionSelect: (champion: ChampionFull) => void;
  isLocked?: boolean;  // When overlay is active, disable all actions
}

interface SelectedSkinItem {
  championId: number;
  championName: string;
  championIcon: string;
  skinId: number;
  skinName: string;
  skinSplash: string;
  chromaId?: number;
  chromaName?: string;
  chromaColors?: string[];
  formId?: number;
  formName?: string;
  formStage?: number;
}

// [HELPER] Check if a hex color is dark (for text contrast)
const isColorDark = (hexColor: string): boolean => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance (perceived brightness)
  // Using formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  
  // If luminance is below threshold, color is dark
  return luminance < 80;
};

// [HELPER] Build selected skins list from skinManager
const buildSelectedSkinsList = (champions: ChampionFull[]): SelectedSkinItem[] => {
  const items: SelectedSkinItem[] = [];
  const selectedMap = skinManager.getAllSelectedSkins();
  
  selectedMap.forEach((skinId, championId) => {
    const champion = champions.find(c => c.id === championId);
    if (!champion) return;
    
    const skin = champion.skins.find(s => s.id === skinId);
    if (!skin) return;
    
    const chroma = skinManager.getSelectedChroma(championId);
    const chromaData = chroma && skin.chromas.find(c => c.id === chroma.chromaId);
    
    const form = skinManager.getSelectedForm(championId);
    const formData = form && skin.forms?.find(f => f.id === form.formId);
    
    items.push({
      championId,
      championName: champion.name,
      championIcon: champion.iconUrl,
      skinId,
      skinName: formData?.name || skin.name,
      skinSplash: formData?.loadScreenPath || skin.loadScreenPath,
      chromaId: chroma?.chromaId,
      chromaName: chromaData?.name.match(/\(([^)]+)\)$/)?.[1] || chromaData?.name,
      chromaColors: chromaData?.colors,
      formId: form?.formId,
      formName: formData?.name,
      formStage: formData?.stage
    });
  });
  
  return items.sort((a, b) => a.championName.localeCompare(b.championName));
};

// [INTERFACE] Selected custom mod item
interface SelectedCustomItem {
  id: string;
  displayName: string;
  thumbnailPath: string | null;
  extension: string;
  isActive: boolean;
  source: 'local' | 'marketplace';
}

// [HELPER] Build selected customs list with IndexedDB thumbnails
const buildSelectedCustomsList = async (): Promise<SelectedCustomItem[]> => {
  const mods = customsStorage.getActiveMods();
  const items: SelectedCustomItem[] = [];
  
  for (const mod of mods) {
    const thumbnail = await customsStorage.getThumbnail(mod.id);
    items.push({
      id: mod.id,
      displayName: mod.displayName,
      thumbnailPath: thumbnail,
      extension: mod.extension || '.fantome',
      isActive: mod.isActive,
      source: mod.source || 'local'
    });
  }
  
  return items;
};

const SelectedSkinsModal = memo(({ champions, onClose, onResetAll, onChampionSelect, isLocked = false }: SelectedSkinsModalProps) => {
  const { t } = useTranslation();

  // [STATE] Selected skins list - reactive to skinManager changes
  const [selectedSkins, setSelectedSkins] = useState<SelectedSkinItem[]>(() => 
    buildSelectedSkinsList(champions)
  );

  // [STATE] Selected customs list - reactive to customsStorage changes
  const [selectedCustoms, setSelectedCustoms] = useState<SelectedCustomItem[]>([]);
  
  // [STATE] Search query for filtering
  const [searchQuery, setSearchQuery] = useState('');

  // [EFFECT] Load customs list on mount
  useEffect(() => {
    buildSelectedCustomsList().then(setSelectedCustoms);
  }, []);

  // [EFFECT] Listen to skinManager changes and update list
  useEffect(() => {
    const updateSkinsList = () => {
      setSelectedSkins(buildSelectedSkinsList(champions));
    };
    
    skinManager.addChangeListener(updateSkinsList);
    return () => skinManager.removeChangeListener(updateSkinsList);
  }, [champions]);

  // [EFFECT] Listen to customsStorage changes and update list
  useEffect(() => {
    const updateCustomsList = async () => {
      const customs = await buildSelectedCustomsList();
      setSelectedCustoms(customs);
    };
    
    customsStorage.addChangeListener(updateCustomsList);
    return () => customsStorage.removeChangeListener(updateCustomsList);
  }, []);

  // [HANDLER] Click on skin item - open SkinSelector for that champion
  const handleItemClick = useCallback((championId: number) => {
    const champion = champions.find(c => c.id === championId);
    if (champion) {
      onClose();
      onChampionSelect(champion);
    }
  }, [champions, onClose, onChampionSelect]);

  // [HANDLER] Remove single skin selection - disabled when overlay active
  const handleRemoveSkin = useCallback((championId: number) => {
    if (isLocked) return;
    skinManager.clearSkinSelection(championId);
  }, [isLocked]);

  // [HANDLER] Remove only chroma, keep skin - disabled when overlay active
  const handleRemoveChroma = useCallback((championId: number) => {
    if (isLocked) return;
    skinManager.clearChromaSelection(championId);
  }, [isLocked]);

  // [HANDLER] Remove only form, keep skin - disabled when overlay active
  const handleRemoveForm = useCallback((championId: number) => {
    if (isLocked) return;
    skinManager.clearFormSelection(championId);
  }, [isLocked]);

  // [HANDLER] Remove custom mod selection - disabled when overlay active
  const handleRemoveCustom = useCallback((customId: string) => {
    if (isLocked) return;
    customsStorage.deactivateMod(customId);
  }, [isLocked]);

  // [HANDLER] Reset all and close - disabled when overlay active
  const handleResetAll = useCallback(() => {
    if (isLocked) return;
    onResetAll();
    customsStorage.deactivateAll();
    onClose();
  }, [onResetAll, onClose, isLocked]);

  // [COMPUTED] Total selected count
  const totalSelected = selectedSkins.length + selectedCustoms.length;
  
  // [COMPUTED] Filtered lists based on search query
  const filteredSkins = searchQuery.trim()
    ? selectedSkins.filter(item =>
        item.championName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.skinName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedSkins;
  
  const filteredCustoms = searchQuery.trim()
    ? selectedCustoms.filter(item =>
        item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedCustoms;
  
  const filteredTotal = filteredSkins.length + filteredCustoms.length;

  const modalContent = (
    <div className="selected-modal-overlay" onClick={onClose}>
      <div className="selected-modal" onClick={e => e.stopPropagation()}>
        <div className="selected-modal-header">
          <div className="selected-modal-title-wrapper">
            <div className="selected-modal-title-row">
              <svg className="selected-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h2 className="selected-modal-title">{t('selectedModal.title')}</h2>
              <span className="selected-modal-count">{totalSelected} {t('selectedModal.items')}</span>
            </div>
            <span className="selected-modal-subtitle">{t('selectedModal.modalDescription', 'Manage your selected skins and custom mods')}</span>
          </div>
          <div className="selected-header-actions">
            <button className="selected-modal-help">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
              <div className="selected-help-tooltip" onClick={e => e.stopPropagation()}>
                <div className="selected-help-title">{t('selectedModal.helpTitle', 'How to Use?')}</div>
                <div className="selected-help-content">{t('selectedModal.helpContent', 'Manage your selected skins and custom mods from this panel.')}</div>
                
                <div className="selected-help-section">
                  <div className="selected-help-section-title">{t('selectedModal.helpActionsTitle', 'Actions')}</div>
                  <div className="selected-help-item no-badge">
                    <span className="help-label">{t('selectedModal.helpClickItem', 'Click Item')}</span>
                    <span className="help-desc">{t('selectedModal.helpClickItemDesc', 'Opens skin selector for that champion')}</span>
                  </div>
                  <div className="selected-help-item no-badge">
                    <span className="help-label">{t('selectedModal.helpSearch', 'Search')}</span>
                    <span className="help-desc">{t('selectedModal.helpSearchDesc', 'Filter selections by name')}</span>
                  </div>
                </div>

                <div className="selected-help-section">
                  <div className="selected-help-section-title">{t('selectedModal.helpButtonsTitle', 'Buttons')}</div>
                  <div className="selected-help-item">
                    <span className="help-badge help-form"></span>
                    <span className="help-label">{t('selectedModal.helpFormBtn', 'Form')}</span>
                    <span className="help-desc">{t('selectedModal.helpFormBtnDesc', 'Remove selected form, keep skin')}</span>
                  </div>
                  <div className="selected-help-item">
                    <span className="help-badge help-chroma"></span>
                    <span className="help-label">{t('selectedModal.helpChromaBtn', 'Chroma')}</span>
                    <span className="help-desc">{t('selectedModal.helpChromaBtnDesc', 'Remove selected chroma, keep skin')}</span>
                  </div>
                  <div className="selected-help-item">
                    <span className="help-badge help-skin"></span>
                    <span className="help-label">{t('selectedModal.helpSkinBtn', 'Skin')}</span>
                    <span className="help-desc">{t('selectedModal.helpSkinBtnDesc', 'Remove entire skin selection')}</span>
                  </div>
                  <div className="selected-help-item">
                    <span className="help-badge help-custom"></span>
                    <span className="help-label">{t('selectedModal.helpCustomBtn', 'Custom')}</span>
                    <span className="help-desc">{t('selectedModal.helpCustomBtnDesc', 'Deactivate custom mod from list')}</span>
                  </div>
                </div>

                <div className="selected-help-section">
                  <div className="selected-help-item reset-item">
                    <span className="help-label">{t('selectedModal.helpReset', 'Reset All')}</span>
                    <span className="help-desc">{t('selectedModal.helpResetDesc', 'Clear all skins and customs at once')}</span>
                  </div>
                </div>
              </div>
            </button>
            <button className="selected-modal-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {totalSelected > 0 && (
          <div className="selected-search-wrapper">
            <div className="selected-search-container">
              <svg className="selected-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="selected-search-input"
                placeholder={t('selectedModal.searchPlaceholder', 'Search selections...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="selected-search-clear" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="selected-modal-content">
          {totalSelected === 0 ? (
            <div className="selected-empty">
              <div className="selected-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 9l6 6m0-6l-6 6"/>
                </svg>
              </div>
              <p className="selected-empty-text">{t('selectedModal.empty')}</p>
            </div>
          ) : (
            <div className="selected-list">
              {/* [SKINS] Champion skins list */}
              {filteredSkins.map(item => (
                <div 
                  key={item.championId} 
                  className="selected-item"
                  onClick={() => handleItemClick(item.championId)}
                >
                  <div className="selected-item-image">
                    <img src={item.skinSplash} alt={item.skinName} />
                    <div className="selected-item-champion-icon">
                      <img src={item.championIcon} alt={item.championName} />
                    </div>
                  </div>
                  
                  <div className="selected-item-info">
                    <span className="selected-item-champion">{item.championName}</span>
                    <span className="selected-item-skin">{item.skinName}</span>
                    {item.formStage && (
                      <div className="selected-item-form">
                        <span className="selected-form-stage">{item.formStage}</span>
                        <span className="selected-form-label">Form</span>
                      </div>
                    )}
                    {item.chromaName && (
                      <div 
                        className="selected-item-chroma"
                        style={{
                          borderColor: item.chromaColors?.[0] ? `${item.chromaColors[0]}40` : undefined,
                          background: item.chromaColors?.[0] ? `${item.chromaColors[0]}15` : undefined
                        }}
                      >
                        {item.chromaColors && item.chromaColors.length > 0 && (
                          <span 
                            className="selected-chroma-dot"
                            style={{ 
                              background: item.chromaColors.length === 1 
                                ? item.chromaColors[0]
                                : `linear-gradient(135deg, ${[...new Set(item.chromaColors)].join(', ')})`
                            }}
                          />
                        )}
                        <span 
                          className="selected-chroma-name"
                          style={{ 
                            color: item.chromaColors?.[0] && isColorDark(item.chromaColors[0]) 
                              ? 'rgba(255, 255, 255, 0.85)' 
                              : item.chromaColors?.[0] || undefined 
                          }}
                        >
                          {item.chromaName}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="selected-item-actions" onClick={e => e.stopPropagation()}>
                    {item.formId && (
                      <div className="action-btn-wrapper">
                        <button 
                          className={`selected-action-btn form-remove ${isLocked ? 'locked' : ''}`}
                          onClick={() => handleRemoveForm(item.championId)}
                          disabled={isLocked}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M9 9l6 6m0-6l-6 6"/>
                          </svg>
                        </button>
                        <span className="action-tooltip form-tooltip">{t('selectedModal.removeForm')}</span>
                      </div>
                    )}
                    {item.chromaId && (
                      <div className="action-btn-wrapper">
                        <button 
                          className={`selected-action-btn chroma-remove ${isLocked ? 'locked' : ''}`}
                          onClick={() => handleRemoveChroma(item.championId)}
                          disabled={isLocked}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M15 9l-6 6m0-6l6 6"/>
                          </svg>
                        </button>
                        <span className="action-tooltip chroma-tooltip">{t('selectedModal.removeChroma')}</span>
                      </div>
                    )}
                    <div className="action-btn-wrapper">
                      <button 
                        className={`selected-action-btn skin-remove ${isLocked ? 'locked' : ''}`}
                        onClick={() => handleRemoveSkin(item.championId)}
                        disabled={isLocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                      <span className="action-tooltip skin-tooltip">{t('selectedModal.removeSkin')}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* [CUSTOMS] Custom mods list */}
              {filteredCustoms.map(item => (
                <div key={item.id} className="selected-item selected-item-custom">
                  <div className="selected-item-image custom-image">
                    <img 
                      src={item.thumbnailPath || '/assets/icons/default_mod.jpg'} 
                      alt={item.displayName}
                      onError={(e) => { e.currentTarget.src = '/assets/icons/default_mod.jpg'; }}
                    />
                  </div>
                  
                  <div className="selected-item-info">
                    <span className={`selected-item-champion custom-label ${item.source === 'marketplace' ? 'marketplace-label' : ''}`}>
                      {item.source === 'marketplace' ? 'MARKETPLACE' : 'CUSTOMS'}
                    </span>
                    <span className="selected-item-skin">{item.displayName}</span>
                    <div className="selected-item-extension">
                      <span>{item.extension.toUpperCase()}</span>
                    </div>
                  </div>
                  
                  <div className="selected-item-actions" onClick={e => e.stopPropagation()}>
                    <div className="action-btn-wrapper">
                      <button 
                        className={`selected-action-btn custom-remove ${isLocked ? 'locked' : ''}`}
                        onClick={() => handleRemoveCustom(item.id)}
                        disabled={isLocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                      <span className="action-tooltip custom-tooltip">{t('selectedModal.removeCustom')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalSelected > 0 && (
          <div className="selected-modal-footer">
            <button 
              className={`selected-reset-all ${isLocked ? 'locked' : ''}`} 
              onClick={handleResetAll}
              disabled={isLocked}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              {t('selectedModal.resetAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

export default SelectedSkinsModal;

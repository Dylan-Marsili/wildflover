/**
 * File: ActivationProgressModal.tsx
 * Author: Wildflover
 * Description: Professional activation progress modal with realistic WAD operation display
 * Language: TypeScript/React
 */

import { memo, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivationProgressModalProps, StageInfo } from './activation-progress/types';
import { OPERATION_LABELS } from './activation-progress/constants';
import { useActivationAnimation } from './activation-progress/useActivationAnimation';
import './ActivationProgressModal.css';

// [COMPONENT] Activation progress modal
const ActivationProgressModal = memo(({ 
  isOpen, 
  progress, 
  selectedSkins, 
  customMods,
  onClose 
}: ActivationProgressModalProps) => {
  const { t } = useTranslation();
  
  // [HOOK] Animation state management
  const {
    allItemsAnimated,
    visualCompletedItems,
    animatingItems,
    getItemStatus,
    getItemOperation,
    sortedSkinIndices,
    sortedCustomIndices
  } = useActivationAnimation(isOpen, progress, selectedSkins, customMods);

  // [COMPUTED] Progress percentage - based on visual animation state
  const progressPercent = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    if (progress.stage === 'error') return 0;
    if (progress.stage === 'detecting') return 5;
    
    const totalItems = selectedSkins.length + customMods.length;
    if (totalItems === 0) return 0;
    
    if (allItemsAnimated && progress.stage === 'complete') return 100;
    
    const visualCompleted = visualCompletedItems.size;
    const animating = animatingItems.size;
    
    const completedPercent = (visualCompleted / totalItems) * 85;
    const animatingPercent = (animating / totalItems) * 5;
    const basePercent = 5;
    
    return Math.min(95, Math.round(basePercent + completedPercent + animatingPercent));
  }, [progress, selectedSkins.length, customMods.length, visualCompletedItems, animatingItems, allItemsAnimated]);

  // [COMPUTED] Stage info with amber for processing states
  const stageInfo: StageInfo = useMemo(() => {
    if (!progress) return { icon: 'loading', color: 'default', label: '' };
    
    if (progress.stage === 'complete' && !allItemsAnimated) {
      return { icon: 'play', color: 'amber', label: t('activation.activating') };
    }
    
    const stages: Record<string, StageInfo> = {
      detecting: { icon: 'search', color: 'cyan', label: t('activation.detecting') },
      downloading: { icon: 'download', color: 'amber', label: t('activation.downloading') },
      preparing: { icon: 'package', color: 'amber', label: t('activation.preparing') },
      activating: { icon: 'play', color: 'amber', label: t('activation.activating') },
      complete: { icon: 'check', color: 'success', label: t('activation.complete') },
      error: { icon: 'error', color: 'error', label: t('activation.error') }
    };
    
    return stages[progress.stage] || stages.detecting;
  }, [progress, t, allItemsAnimated]);

  // [COMPUTED] Is complete or error
  const isFinished = (progress?.stage === 'complete' && allItemsAnimated) || progress?.stage === 'error';
  const isSuccess = progress?.stage === 'complete' && allItemsAnimated;

  // [HELPER] Get operation label
  const getOperationLabel = (phase: string): string => OPERATION_LABELS[phase] || 'Processing';

  // [EFFECT] Auto close after success (2 seconds delay)
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  // [COMPUTED] Progress message
  const progressMessage = useMemo(() => {
    if (!progress) return t('activation.initializing');
    if (progress.stage === 'detecting') return t('activation.detectingDesc');
    if (progress.stage === 'complete') return `${t('activation.completedIn')}: ${progress.message}`;
    if (progress.stage === 'error') return progress.message;
    
    const completed = progress.completedItems?.length || 0;
    return t('activation.processing', { current: completed, total: progress.total });
  }, [progress, t]);

  if (!isOpen) return null;


  return (
    <div className="activation-modal-overlay" onClick={isFinished ? onClose : undefined}>
      <div className={`activation-modal ${isSuccess ? 'complete' : ''}`} onClick={e => e.stopPropagation()}>
        {/* [HEADER] Modal header */}
        <div className="activation-modal-header">
          <div className="activation-title-wrapper">
            <div className={`activation-icon ${stageInfo.color}`}>
              {stageInfo.icon === 'check' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {stageInfo.icon === 'error' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              )}
              {!isFinished && <div className="activation-spinner" />}
            </div>
            <div className="activation-title-text">
              <h2 className="activation-title">{t('activation.title')}</h2>
              <span className={`activation-stage ${stageInfo.color}`}>{stageInfo.label}</span>
            </div>
          </div>
          {isFinished && (
            <button className="activation-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* [PROGRESS] Progress bar section */}
        <div className="activation-progress-section">
          <div className="activation-progress-bar">
            <div className={`activation-progress-fill ${stageInfo.color}`} style={{ width: `${progressPercent}%` }} />
            <div className="activation-progress-glow" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="activation-progress-info">
            <span className="activation-progress-text">{progressMessage}</span>
            <span className="activation-progress-percent">{progressPercent}%</span>
          </div>
        </div>

        {/* [CONTENT] Items being activated */}
        <div className="activation-content">
          {/* [SKINS] Selected skins section */}
          {selectedSkins.length > 0 && (
            <div className="activation-section">
              <div className="activation-section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                <span>{t('activation.skins')}</span>
                <span className="activation-section-count">{selectedSkins.length}</span>
              </div>
              <div className="activation-items">
                {sortedSkinIndices.map((idx) => {
                  const skin = selectedSkins[idx];
                  const status = getItemStatus(idx);
                  const operation = getItemOperation(idx);
                  return (
                    <div key={`skin-${idx}`} className={`activation-item ${status}`}>
                      <div className="activation-item-image">
                        <img src={skin.splashUrl} alt={skin.skinName} />
                        {skin.iconUrl && (
                          <div className="activation-item-icon">
                            <img src={skin.iconUrl} alt={skin.championName} />
                          </div>
                        )}
                      </div>
                      <div className="activation-item-info">
                        <span className="activation-item-champion">{skin.championName}</span>
                        <span className="activation-item-name">{skin.skinName}</span>
                        {skin.chromaName && (
                          <div className="activation-item-chroma"
                            style={{
                              background: skin.chromaColor ? `${skin.chromaColor}15` : 'rgba(186, 85, 211, 0.1)',
                              borderColor: skin.chromaColor ? `${skin.chromaColor}40` : 'rgba(186, 85, 211, 0.25)'
                            }}>
                            <span className="activation-chroma-dot" style={{ background: skin.chromaColor || '#ba55d3' }}/>
                            <span className="chroma-label" style={{ color: skin.chromaColor || 'rgba(255, 255, 255, 0.85)' }}>
                              {skin.chromaName}
                            </span>
                          </div>
                        )}
                        {skin.formName && (
                          <div className="activation-item-form">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span className="form-label">{skin.formName}</span>
                          </div>
                        )}
                        {status === 'processing' && operation && (
                          <div className="activation-item-operation">
                            <span className="operation-phase">{getOperationLabel(operation.phase)}</span>
                            {operation.file && <span className="operation-file">{operation.file}</span>}
                          </div>
                        )}
                      </div>
                      <div className={`activation-item-status ${status}`}>
                        {status === 'done' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {status === 'error' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        )}
                        {status === 'processing' && <div className="item-spinner amber" />}
                        {status === 'pending' && <div className="item-pending" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* [CUSTOMS] Custom mods section */}
          {customMods.length > 0 && (
            <div className="activation-section">
              <div className="activation-section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                <span>{t('activation.customs')}</span>
                <span className="activation-section-count">{customMods.length}</span>
              </div>
              <div className="activation-items">
                {sortedCustomIndices.map((idx) => {
                  const mod = customMods[idx];
                  const itemIndex = selectedSkins.length + idx;
                  const status = getItemStatus(itemIndex);
                  const operation = getItemOperation(itemIndex);
                  return (
                    <div key={`mod-${idx}`} className={`activation-item custom ${status}`}>
                      <div className="activation-item-image custom-image">
                        {mod.thumbnail ? (
                          <img src={mod.thumbnail} alt={mod.name} />
                        ) : (
                          <div className="custom-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="activation-item-info">
                        <span className="activation-item-label">CUSTOM MOD</span>
                        <span className="activation-item-name">{mod.name}</span>
                        {status === 'processing' && operation && (
                          <div className="activation-item-operation">
                            <span className="operation-phase">{getOperationLabel(operation.phase)}</span>
                            {operation.file && <span className="operation-file">{operation.file}</span>}
                          </div>
                        )}
                      </div>
                      <div className={`activation-item-status ${status}`}>
                        {status === 'done' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {status === 'error' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        )}
                        {status === 'processing' && <div className="item-spinner amber" />}
                        {status === 'pending' && <div className="item-pending" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* [FOOTER] Status footer */}
        <div className={`activation-footer ${stageInfo.color}`}>
          {progress?.stage === 'complete' && allItemsAnimated && (
            <div className="activation-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>{t('activation.successMessage')}</span>
            </div>
          )}
          {progress?.stage === 'error' && (
            <div className="activation-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{progress.message}</span>
            </div>
          )}
          {!isFinished && (
            <div className="activation-processing">
              <div className="processing-dots"><span /><span /><span /></div>
              <span>{stageInfo.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ActivationProgressModal;

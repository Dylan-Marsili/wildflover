/**
 * File: SelectionFab.tsx
 * Author: Wildflover
 * Description: Anime-style floating action button for selection indicator
 *              - Shows selected count with animation
 *              - Activate/Stop overlay toggle button
 *              - Reset selections button
 * Language: TypeScript/React
 */

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { skinManager } from '../services/skinManager';
import { customsStorage } from '../services/customsStorage';
import { modActivator } from '../services/modActivator';
import './SelectionFab.css';

interface SelectionFabProps {
  onClick: () => void;
  onReset: () => void;
  onActivate: () => void;
  onStop?: () => void;
  overlayActive?: boolean;
  isLocked?: boolean;  // When overlay is active, disable reset button
}

const SelectionFab = memo(({ onClick, onReset, onActivate, onStop, overlayActive = false, isLocked = false }: SelectionFabProps) => {
  const { t } = useTranslation();
  const [count, setCount] = useState(() => 
    skinManager.getAllSelectedSkins().size + customsStorage.getActiveCount()
  );
  const [isOverlayActive, setIsOverlayActive] = useState(overlayActive);
  const [isStopping, setIsStopping] = useState(false);
  const prevCountRef = useRef(count);
  const [countDirection, setCountDirection] = useState<'up' | 'down' | null>(null);
  const [isFirstMount, setIsFirstMount] = useState(true);

  // [EFFECT] Remove first mount flag after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFirstMount(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // [EFFECT] Sync with prop
  useEffect(() => {
    setIsOverlayActive(overlayActive);
  }, [overlayActive]);

  // [EFFECT] Listen to selection changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const updateCount = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newCount = skinManager.getAllSelectedSkins().size + customsStorage.getActiveCount();
        
        if (newCount !== prevCountRef.current) {
          setCountDirection(newCount > prevCountRef.current ? 'up' : 'down');
          prevCountRef.current = newCount;
          setCount(newCount);
          setTimeout(() => setCountDirection(null), 400);
        }
      }, 50);
    };

    skinManager.addChangeListener(updateCount);
    customsStorage.addChangeListener(updateCount);

    return () => {
      clearTimeout(timeoutId);
      skinManager.removeChangeListener(updateCount);
      customsStorage.removeChangeListener(updateCount);
    };
  }, []);

  // [HANDLER] Reset selections - disabled when overlay active
  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    onReset();
  }, [onReset, isLocked]);

  // [HANDLER] Activate or Stop overlay
  const handleActivateOrStop = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[SELECTION-FAB] Button clicked, isOverlayActive:', isOverlayActive);
    
    if (isOverlayActive) {
      setIsStopping(true);
      if (onStop) {
        onStop();
      } else {
        await modActivator.stopOverlay();
      }
      setIsStopping(false);
      setIsOverlayActive(false);
    } else {
      console.log('[SELECTION-FAB] Calling onActivate...');
      onActivate();
    }
  }, [isOverlayActive, onActivate, onStop]);

  // [HANDLER] Main FAB click
  const handleFabClick = useCallback(() => {
    onClick();
  }, [onClick]);

  // Don't render if no selections
  if (count === 0) return null;

  return (
    <div 
      className={`selection-fab ${isOverlayActive ? 'overlay-active' : ''} ${isFirstMount ? 'first-mount' : ''}`}
      onClick={handleFabClick}
    >
      {/* [GLOW] Animated background glow */}
      <div className="fab-glow" />
      
      {/* [BORDER] Animated gradient border */}
      <div className="fab-border" />
      
      {/* [CONTENT] Main content */}
      <div className="fab-inner">
        {/* [ICON] Anime crystal/gem icon */}
        <div className="fab-icon-wrapper">
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 9L12 22L20 9L12 2Z" fill="currentColor" opacity="0.9"/>
            <path d="M12 2L4 9L12 12L12 2Z" fill="currentColor" opacity="0.7"/>
            <path d="M12 2L20 9L12 12L12 2Z" fill="currentColor" opacity="1"/>
            <path d="M4 9L12 22L12 12L4 9Z" fill="currentColor" opacity="0.6"/>
            <path d="M14 5L16 7L14 8L14 5Z" fill="currentColor" opacity="0.4"/>
          </svg>
          <div className="fab-icon-ring" />
        </div>

        {/* [COUNT] Selection count */}
        <div className="fab-count-wrapper">
          <span className={`fab-count ${countDirection ? `count-${countDirection}` : ''}`}>
            {count}
          </span>
          <span className="fab-label">{t('stats.selected')}</span>
        </div>

        {/* [ACTIVATE/STOP] Toggle button with tooltip */}
        <div className="fab-btn-wrapper">
          <button 
            className={`fab-activate ${isOverlayActive ? 'active' : ''} ${isStopping ? 'stopping' : ''}`} 
            onClick={handleActivateOrStop}
            disabled={isStopping}
          >
            {isStopping ? (
              <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/>
              </svg>
            ) : isOverlayActive ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>
          <span className="fab-tooltip activate-tooltip">
            {isOverlayActive ? t('fab.stopOverlay') : t('fab.activate')}
          </span>
        </div>

        {/* [RESET] Reset button with tooltip */}
        <div className="fab-btn-wrapper">
          <button className={`fab-reset ${isLocked ? 'disabled' : ''}`} onClick={handleReset} disabled={isLocked}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
          <span className="fab-tooltip reset-tooltip">{t('fab.resetAll')}</span>
        </div>
      </div>

      {/* [PARTICLES] Decorative particles */}
      <div className="fab-particles">
        <span className="particle p1" />
        <span className="particle p2" />
        <span className="particle p3" />
      </div>
    </div>
  );
});

export default SelectionFab;

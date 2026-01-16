/**
 * File: TitleBar.tsx
 * Author: Wildflover
 * Description: Custom window titlebar with native-like controls and help button
 * Language: TypeScript/React
 */

import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

// [PROPS] TitleBar component props
interface TitleBarProps {
  onHelpClick?: () => void;
}

// [COMPONENT] Custom titlebar with window controls
const TitleBar: React.FC<TitleBarProps> = ({ onHelpClick }) => {
  const appWindow = getCurrentWindow();

  // [HANDLER] Minimize window
  const handleMinimize = useCallback(async () => {
    await appWindow.minimize();
  }, [appWindow]);

  // [HANDLER] Toggle maximize/restore
  const handleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
  }, [appWindow]);

  // [HANDLER] Close window
  const handleClose = useCallback(async () => {
    await appWindow.close();
  }, [appWindow]);

  // [HANDLER] Help button click
  const handleHelp = useCallback(() => {
    if (onHelpClick) {
      onHelpClick();
    }
  }, [onHelpClick]);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-content">
        <div className="titlebar-brand" />

        <div className="titlebar-controls">
          {onHelpClick && (
            <button 
              className="titlebar-button help" 
              onClick={handleHelp}
              aria-label="Help"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5.5 5.5C5.5 4.39543 6.39543 3.5 7.5 3.5C8.60457 3.5 9.5 4.39543 9.5 5.5C9.5 6.30622 9.02513 7.00251 8.33333 7.29167C7.64154 7.58083 7 8.08333 7 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="7" cy="10.5" r="0.75" fill="currentColor"/>
              </svg>
            </button>
          )}
          <button 
            className="titlebar-button minimize" 
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
            </svg>
          </button>
          <button 
            className="titlebar-button maximize" 
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="0" y="0" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button 
            className="titlebar-button close" 
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;

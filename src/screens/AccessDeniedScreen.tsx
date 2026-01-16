/**
 * File: AccessDeniedScreen.tsx
 * Author: Wildflover
 * Description: Access denied screen when user is not in required Discord guild
 * Language: TypeScript/React
 */

import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { discordAuth } from '../services/discord';
import './AccessDeniedScreen.css';

// [PROPS] Component property definitions
interface AccessDeniedScreenProps {
  reason: string;
  onRetry: () => void;
}

// [COMPONENT] Access denied screen
const AccessDeniedScreen = ({ reason, onRetry }: AccessDeniedScreenProps) => {
  // [FUNC] Handle logout and retry
  const handleRetry = useCallback(() => {
    // Use clearAllData to clear everything including verification cache on denied
    discordAuth.clearAllData();
    onRetry();
  }, [onRetry]);

  // [FUNC] Handle close application
  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  }, []);

  return (
    <div className="access-denied-screen" data-tauri-drag-region>


      <div className="access-denied-content" data-tauri-drag-region>
        {/* [LOGO] Logo section */}
        <div className="denied-logo-section">
          <div className="denied-logo-container">
            <div className="denied-logo-ring" />
            <div className="denied-logo-core">
              <img src="/assets/icons/login_icon.jpg" alt="Wildflover Logo" />
            </div>
          </div>
          
          <div className="denied-title-group">
            <h1 className="denied-title">
              <span className="title-wild">Wild</span>
              <span className="title-flower">flover</span>
            </h1>
            <p className="denied-subtitle">Access Denied</p>
          </div>
        </div>

        {/* [TEXT] Message section */}
        <div className="denied-message-section">
          <p className="denied-description">{reason}</p>
          <p className="denied-hint">Join the required Discord server and try again.</p>
        </div>

        {/* [ACTIONS] Action buttons */}
        <div className="denied-actions">
          <button className="denied-retry-btn" onClick={handleRetry}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>Try Again</span>
          </button>
          <button className="denied-close-btn" onClick={handleClose}>
            <span>Close Application</span>
          </button>
        </div>
      </div>

      {/* [FOOTER] Footer - positioned at bottom */}
      <div className="denied-footer" data-tauri-drag-region>
        <span className="denied-footer-text">by Wildflover</span>
      </div>
    </div>
  );
};

export default AccessDeniedScreen;

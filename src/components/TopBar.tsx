/**
 * File: TopBar.tsx
 * Author: Wildflover
 * Description: Navigation topbar with memoized nav items and Discord user profile
 * Language: TypeScript/React
 */

import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { discordAuth, getAvatarUrl } from '../services/discord';
import type { DiscordUser } from '../types/discord';
import './TopBar.css';

// [TYPES] View type definitions
type AppView = 'dashboard' | 'champions' | 'customs' | 'favorites' | 'marketplace' | 'settings';

// [PROPS] Component property definitions
interface TopBarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  discordUser?: DiscordUser | null;
  onLogout?: () => void;
}

// [COMPONENT] Memoized topbar for render optimization
const TopBar = memo(({ currentView, onViewChange, discordUser, onLogout }: TopBarProps) => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // [EFFECT] Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // [HANDLER] Toggle dropdown
  const handleUserClick = useCallback(() => {
    setShowDropdown(prev => !prev);
  }, []);

  // [HANDLER] Logout
  const handleLogout = useCallback(async () => {
    setShowDropdown(false);
    await discordAuth.logout();
    onLogout?.();
  }, [onLogout]);

  // [MEMO] Navigation items - memoized to prevent recreation on each render
  const navItems = useMemo(() => [
    { 
      id: 'dashboard' as AppView, 
      label: t('nav.dashboard'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="9" rx="1"/>
          <rect x="14" y="3" width="7" height="5" rx="1"/>
          <rect x="14" y="12" width="7" height="9" rx="1"/>
          <rect x="3" y="16" width="7" height="5" rx="1"/>
        </svg>
      )
    },
    { 
      id: 'champions' as AppView, 
      label: t('nav.champions'),
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
      id: 'customs' as AppView, 
      label: t('nav.customs'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M12 18v-6"/>
          <path d="M9 15h6"/>
        </svg>
      )
    },
    { 
      id: 'marketplace' as AppView, 
      label: t('nav.marketplace', 'Shop'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      )
    },
    { 
      id: 'favorites' as AppView, 
      label: t('nav.favorites'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )
    },
    { 
      id: 'settings' as AppView, 
      label: t('nav.settings'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      )
    }
  ], [t]);

  // [HANDLER] Memoized view change handler
  const handleViewChange = useCallback((id: AppView) => {
    onViewChange(id);
  }, [onViewChange]);

  return (
    <div className="topbar">
      {/* [LEFT] Brand section */}
      <div className="topbar-left">
        <div className="topbar-brand">
          <img 
            src="/assets/icons/icon.png" 
            alt="Wildflover" 
            className="brand-icon"
          />
          <span className="brand-text">
            <span className="brand-wild">Wild</span>
            <span className="brand-flower">flover</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-subtitle">{t('app.subtitle')}</span>
        </div>
      </div>

      {/* [CENTER] Navigation */}
      <nav className="topbar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-btn ${currentView === item.id ? 'active' : ''}`}
            onClick={() => handleViewChange(item.id)}
          >
            <span className="nav-btn-icon">{item.icon}</span>
            <span className="nav-btn-label">{item.label}</span>
            {currentView === item.id && <span className="nav-btn-indicator" />}
          </button>
        ))}
      </nav>

      {/* [RIGHT] Discord user profile section */}
      <div className="topbar-right">
        {discordUser && (
          <div className="topbar-user-container" ref={dropdownRef}>
            <button className="topbar-user" onClick={handleUserClick}>
              <div className="topbar-user-info">
                <span className="topbar-user-displayname">
                  {discordUser.global_name || discordUser.username}
                </span>
                <span className="topbar-user-username">@{discordUser.username}</span>
              </div>
              <img 
                src={getAvatarUrl(discordUser.id, discordUser.avatar, 64)} 
                alt={discordUser.username}
                className="topbar-user-avatar"
              />
            </button>
            
            {/* [DROPDOWN] User dropdown menu */}
            {showDropdown && (
              <div className="topbar-user-dropdown">
                <button className="dropdown-item logout" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>{t('topbar.logout')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default TopBar;

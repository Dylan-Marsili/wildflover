/**
 * File: SettingsModal.tsx
 * Author: Wildflover
 * Description: Settings modal with language selection and app preferences
 *              - LocalStorage persistence for user settings
 *              - Tauri invoke for minimize to tray setting
 *              - Cache cleanup management with full reset
 * Language: TypeScript/React
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, LanguageCode } from '../i18n';
import { discordRpc } from '../services/discord';
import './SettingsModal.css';

// [PROPS] Component property definitions
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSelections?: () => void;
}

// [TYPES] Tab type definition
type SettingsTab = 'general' | 'language' | 'cleanup' | 'about';

// [TYPES] Settings state interface
interface AppSettings {
  minimizeToTray: boolean;
  discordRpc: boolean;
}

// [TYPES] Cache file info
interface CacheFileInfo {
  name: string;
  path: string;
  size: number;
  modified: number;
}

// [TYPES] Cache info from backend
interface CacheInfo {
  path: string;
  total_size: number;
  file_count: number;
  files: CacheFileInfo[];
}

// [CONSTANTS] LocalStorage key
const SETTINGS_STORAGE_KEY = 'wildflover_settings';

// [UTILS] Load settings from localStorage
const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // [DEFAULT] Ensure discordRpc defaults to true if not set
      return {
        minimizeToTray: parsed.minimizeToTray ?? false,
        discordRpc: parsed.discordRpc ?? true
      };
    }
  } catch (e) {
    console.warn('[SETTINGS-LOAD] Failed to parse stored settings');
  }
  // [DEFAULT] First launch defaults - Discord RPC enabled by default
  return {
    minimizeToTray: false,
    discordRpc: true
  };
};

// [UTILS] Save settings to localStorage
const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[SETTINGS-SAVE] Failed to save settings');
  }
};

// [UTILS] Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// [COMPONENT] Settings modal
const SettingsModal = ({ isOpen, onClose, onResetSelections }: SettingsModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(getCurrentLanguage());
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // [STATE] Game path management
  const [gamePath, setGamePath] = useState<string | null>(null);
  const [isLoadingGamePath, setIsLoadingGamePath] = useState(false);
  const [gamePathError, setGamePathError] = useState<string | null>(null);
  const [gamePathSuccess, setGamePathSuccess] = useState<string | null>(null);

  // [EFFECT] Save settings when changed and sync with Tauri
  useEffect(() => {
    saveSettings(settings);
    // [INVOKE] Sync minimize to tray setting with Rust backend
    invoke('set_minimize_to_tray', { enabled: settings.minimizeToTray }).catch((err) => {
      console.warn('[SETTINGS-SYNC] Failed to sync tray setting:', err);
    });
  }, [settings.minimizeToTray]);

  // [EFFECT] Sync Discord RPC setting
  useEffect(() => {
    const syncRpc = async () => {
      if (settings.discordRpc) {
        await discordRpc.enable();
      } else {
        await discordRpc.disable();
      }
    };
    syncRpc();
    saveSettings(settings);
  }, [settings.discordRpc]);

  // [EFFECT] Load cache info when cleanup tab is active
  useEffect(() => {
    if (activeTab === 'cleanup' && !cacheInfo && !isLoadingCache) {
      loadCacheInfo();
    }
  }, [activeTab, cacheInfo, isLoadingCache]);

  // [EFFECT] Load game path when general tab is active
  useEffect(() => {
    if (activeTab === 'general' && gamePath === null && !isLoadingGamePath) {
      loadGamePath();
    }
  }, [activeTab, gamePath, isLoadingGamePath]);

  // [HANDLER] Load game path from backend
  const loadGamePath = useCallback(async () => {
    setIsLoadingGamePath(true);
    setGamePathError(null);
    try {
      const path = await invoke<string | null>('detect_game_path');
      setGamePath(path || '');
      console.log('[SETTINGS-GAMEPATH] Loaded:', path || 'Not found');
    } catch (err) {
      console.error('[SETTINGS-GAMEPATH] Failed to load:', err);
      setGamePath('');
    } finally {
      setIsLoadingGamePath(false);
    }
  }, []);

  // [HANDLER] Browse for game executable
  const handleBrowseGamePath = useCallback(async () => {
    setGamePathError(null);
    setGamePathSuccess(null);
    try {
      const result = await invoke<{ success: boolean; path: string | null; cancelled: boolean; error: string | null }>('browse_game_path');
      
      if (result.cancelled) {
        // User cancelled - don't show any message
        console.log('[SETTINGS-GAMEPATH] Browse cancelled by user');
        return;
      }
      
      if (result.success && result.path) {
        // Valid League of Legends.exe selected - save the path
        const saved = await invoke<boolean>('set_game_path', { path: result.path });
        if (saved) {
          setGamePath(result.path);
          setGamePathError(null);
          setGamePathSuccess(t('settings.gamePathSet'));
          console.log('[SETTINGS-GAMEPATH] Set to:', result.path);
          // Clear success message after 3 seconds
          setTimeout(() => setGamePathSuccess(null), 3000);
        } else {
          setGamePathError(t('settings.gamePathInvalid'));
        }
      } else {
        // Invalid file selected (not League of Legends.exe)
        setGamePathError(t('settings.gamePathInvalid'));
        console.log('[SETTINGS-GAMEPATH] Invalid file:', result.error);
      }
    } catch (err) {
      console.error('[SETTINGS-GAMEPATH] Browse failed:', err);
      setGamePathError(t('settings.gamePathInvalid'));
    }
  }, [t]);

  // [HANDLER] Clear game path - revert to auto-detect
  const handleClearGamePath = useCallback(async () => {
    setGamePathError(null);
    setGamePathSuccess(null);
    try {
      await invoke('clear_game_path');
      // Reload to get auto-detected path
      const path = await invoke<string | null>('detect_game_path');
      setGamePath(path || '');
      setGamePathSuccess(t('settings.gamePathCleared'));
      console.log('[SETTINGS-GAMEPATH] Cleared, auto-detect:', path || 'Not found');
      // Clear success message after 3 seconds
      setTimeout(() => setGamePathSuccess(null), 3000);
    } catch (err) {
      console.error('[SETTINGS-GAMEPATH] Clear failed:', err);
    }
  }, [t]);

  // [HANDLER] Load cache information
  const loadCacheInfo = useCallback(async () => {
    setIsLoadingCache(true);
    try {
      const info = await invoke<CacheInfo>('get_cache_info');
      setCacheInfo(info);
      console.log('[SETTINGS-CACHE] Cache info loaded:', info);
    } catch (err) {
      console.error('[SETTINGS-CACHE] Failed to load cache info:', err);
      setCacheInfo({ path: '', total_size: 0, file_count: 0, files: [] });
    } finally {
      setIsLoadingCache(false);
    }
  }, []);

  // [HANDLER] Show confirm dialog for cache clear
  const handleClearCacheClick = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  // [HANDLER] Confirm and clear all mod cache (preserves Discord auth)
  const handleConfirmClearCache = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsClearing(true);
    try {
      // Stop overlay first if running
      await invoke('stop_overlay').catch(() => {});
      
      // Clear all mod cache (mods + installed + overlay + profile)
      // NOTE: Discord auth is stored separately in localStorage, not affected
      await invoke('cleanup_overlay');
      await invoke('clear_cache');
      
      // Reset app selections (skins + customs)
      if (onResetSelections) {
        onResetSelections();
      }
      
      setCacheInfo({ path: cacheInfo?.path || '', total_size: 0, file_count: 0, files: [] });
      console.log('[SETTINGS-CACHE] Mod cache cleared, Discord auth preserved');
    } catch (err) {
      console.error('[SETTINGS-CACHE] Failed to clear cache:', err);
    } finally {
      setIsClearing(false);
    }
  }, [cacheInfo?.path, onResetSelections]);

  // [HANDLER] Copy path to clipboard with visual feedback
  const handleCopyPath = useCallback(async () => {
    if (cacheInfo?.path) {
      try {
        await navigator.clipboard.writeText(cacheInfo.path);
        setIsCopied(true);
        console.log('[SETTINGS-CACHE] Path copied to clipboard');
        
        // Reset after 2 seconds
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('[SETTINGS-CACHE] Failed to copy path:', err);
      }
    }
  }, [cacheInfo?.path]);

  // [HANDLER] Open folder in file explorer via Rust command
  const handleOpenFolder = useCallback(async () => {
    if (cacheInfo?.path) {
      try {
        await invoke('open_folder_in_explorer', { path: cacheInfo.path });
        console.log('[SETTINGS-CACHE] Opened folder in explorer');
      } catch (err) {
        console.error('[SETTINGS-CACHE] Failed to open folder:', err);
      }
    }
  }, [cacheInfo?.path]);

  // [HANDLER] Delete single file
  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      await invoke('delete_cache_file', { path: filePath });
      // Reload cache info
      loadCacheInfo();
    } catch (err) {
      console.error('[SETTINGS-CACHE] Failed to delete file:', err);
    }
  }, [loadCacheInfo]);

  // [HANDLER] Toggle setting change
  const handleSettingChange = useCallback((key: keyof AppSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // [HANDLER] Language change
  const handleLanguageChange = useCallback((langCode: LanguageCode) => {
    setSelectedLang(langCode);
    changeLanguage(langCode);
  }, []);

  // [HANDLER] Backdrop click to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // [HANDLER] Tab change
  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  // [MEMO] Tab configuration
  const tabs = useMemo(() => [
    { id: 'general' as SettingsTab, label: t('settings.title'), icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    )},
    { id: 'language' as SettingsTab, label: t('settings.language'), icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    )},
    { id: 'cleanup' as SettingsTab, label: t('settings.cleanup'), icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    )},
    { id: 'about' as SettingsTab, label: t('settings.about'), icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="M12 16v-4"/>
        <circle cx="12" cy="8" r="0.5" fill="currentColor"/>
      </svg>
    )}
  ], [t]);

  // [RENDER] Early return if not open
  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal">
        {/* [HEADER] Modal header - Upload Modal style */}
        <div className="settings-header">
          <div className="settings-header-title">
            <h2>
              <svg className="settings-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              {t('settings.title')}
            </h2>
            <span className="settings-modal-subtitle">{t('settings.modalDescription')}</span>
          </div>
          <div className="settings-header-actions">
            <button className="settings-modal-help">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
              <div className="settings-help-tooltip" onClick={e => e.stopPropagation()}>
                <div className="settings-help-title">{t('settings.helpTitle')}</div>
                <div className="settings-help-content">{t('settings.helpContent')}</div>
                <div className="settings-help-section">
                  <div className="settings-help-section-title">{t('settings.helpTabsTitle')}</div>
                  <div className="settings-help-item">
                    <span className="settings-help-label">{t('settings.title')}</span>
                    <span className="settings-help-desc">{t('settings.helpGeneralDesc')}</span>
                  </div>
                  <div className="settings-help-item">
                    <span className="settings-help-label">{t('settings.language')}</span>
                    <span className="settings-help-desc">{t('settings.helpLanguageDesc')}</span>
                  </div>
                  <div className="settings-help-item">
                    <span className="settings-help-label">{t('settings.cleanup')}</span>
                    <span className="settings-help-desc">{t('settings.helpCleanupDesc')}</span>
                  </div>
                  <div className="settings-help-item">
                    <span className="settings-help-label">{t('settings.about')}</span>
                    <span className="settings-help-desc">{t('settings.helpAboutDesc')}</span>
                  </div>
                </div>
              </div>
            </button>
            <button className="settings-modal-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* [CONTENT] Modal content */}
        <div className="settings-content">
          {/* [SIDEBAR] Tab navigation */}
          <div className="settings-sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* [MAIN] Tab content */}
          <div className="settings-main">
            {activeTab === 'language' && (
              <div className="settings-section">
                <h3 className="section-title">{t('settings.language')}</h3>
                <p className="section-desc">{t('settings.selectLanguage')}</p>
                <div className="language-grid">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      className={`language-option ${selectedLang === lang.code ? 'selected' : ''}`}
                      onClick={() => handleLanguageChange(lang.code)}
                    >
                      <span className="lang-flag">{lang.flag}</span>
                      <div className="lang-info">
                        <span className="lang-native">{lang.nativeName}</span>
                        <span className="lang-name">{lang.name}</span>
                      </div>
                      {selectedLang === lang.code && (
                        <span className="lang-check">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="settings-section">
                <h3 className="section-title">{t('settings.title')}</h3>
                <p className="section-desc">{t('settings.configurePreferences')}</p>
                <div className="settings-options">
                  {/* [GAME-PATH] League of Legends installation path */}
                  <div className="option-item game-path-item">
                    <div className="option-info">
                      <span className="option-label">{t('settings.gamePath')}</span>
                      <span className="option-desc">{t('settings.gamePathDesc')}</span>
                    </div>
                    <div className="game-path-controls">
                      {isLoadingGamePath ? (
                        <div className="game-path-loading">
                          <div className="path-spinner" />
                        </div>
                      ) : (
                        <>
                          <div className="game-path-display">
                            {gamePath ? (
                              <span className="path-value" title={gamePath}>{gamePath}</span>
                            ) : (
                              <span className="path-not-found">{t('settings.gamePathNotFound')}</span>
                            )}
                          </div>
                          <div className="game-path-actions">
                            <button 
                              className="path-action-btn browse-btn"
                              onClick={handleBrowseGamePath}
                              title={t('settings.gamePathBrowse')}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                              </svg>
                              <span>{t('settings.gamePathBrowse')}</span>
                            </button>
                            {gamePath && (
                              <button 
                                className="path-action-btn clear-btn"
                                onClick={handleClearGamePath}
                                title={t('settings.gamePathClear')}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M23 4v6h-6"/>
                                  <path d="M1 20v-6h6"/>
                                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {gamePathError && (
                      <div className="game-path-error">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>{gamePathError}</span>
                      </div>
                    )}
                    {gamePathSuccess && (
                      <div className="game-path-success">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{gamePathSuccess}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="option-item">
                    <div className="option-info">
                      <span className="option-label">{t('settings.minimizeToTray')}</span>
                      <span className="option-desc">{t('settings.minimizeToTrayDesc')}</span>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.minimizeToTray}
                        onChange={() => handleSettingChange('minimizeToTray')}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="option-item">
                    <div className="option-info">
                      <span className="option-label">{t('settings.discordRpc')}</span>
                      <span className="option-desc">{t('settings.discordRpcDesc')}</span>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.discordRpc}
                        onChange={() => handleSettingChange('discordRpc')}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cleanup' && (
              <div className="settings-section cleanup-section">
                <div className="section-header-row">
                  <div className="section-header-text">
                    <h3 className="section-title">{t('settings.cleanupTitle')}</h3>
                    <p className="section-desc">{t('settings.cleanupDesc')}</p>
                  </div>
                  <button 
                    className={`refresh-cache-btn ${isLoadingCache ? 'loading' : ''}`}
                    onClick={loadCacheInfo}
                    disabled={isLoadingCache}
                    data-tooltip={t('settings.refreshCache')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6"/>
                      <path d="M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                  </button>
                </div>
                
                {isLoadingCache ? (
                  <div className="cleanup-loading">
                    <div className="cleanup-spinner" />
                    <span>{t('settings.scanning')}</span>
                  </div>
                ) : cacheInfo ? (
                  <>
                    {/* [STATS] Cache statistics */}
                    <div className="cleanup-stats">
                      <div className="cleanup-stat">
                        <div className="stat-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </div>
                        <div className="stat-info">
                          <span className="stat-label">{t('settings.cacheLocation')}</span>
                          <span className="stat-value path">{cacheInfo.path || 'N/A'}</span>
                        </div>
                        <div className="stat-actions">
                          <button 
                            className={`stat-action-btn ${isCopied ? 'copied' : ''}`}
                            onClick={handleCopyPath}
                            data-tooltip={isCopied ? t('settings.copied') : t('settings.copyPath')}
                          >
                            {isCopied ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                          <button 
                            className="stat-action-btn"
                            onClick={handleOpenFolder}
                            data-tooltip={t('settings.openFolder')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/>
                              <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="cleanup-stat-row">
                        <div className="cleanup-stat small">
                          <div className="stat-icon small">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          </div>
                          <div className="stat-info">
                            <span className="stat-label">{t('settings.totalSize')}</span>
                            <span className="stat-value highlight">{formatFileSize(cacheInfo.total_size)}</span>
                          </div>
                        </div>
                        <div className="cleanup-stat small">
                          <div className="stat-icon small">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div className="stat-info">
                            <span className="stat-label">{t('settings.fileCount')}</span>
                            <span className="stat-value">{cacheInfo.file_count}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* [FILES] File list */}
                    <div className="cleanup-files">
                      <div className="files-header">
                        <span>{t('settings.cachedFiles')}</span>
                        {cacheInfo.file_count > 0 && (
                          <button 
                            className="clear-all-btn"
                            onClick={handleClearCacheClick}
                            disabled={isClearing}
                          >
                            {isClearing ? (
                              <div className="btn-spinner" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            )}
                            <span>{t('settings.clearCache')}</span>
                          </button>
                        )}
                      </div>
                      
                      {cacheInfo.files.length === 0 ? (
                        <div className="files-empty">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            <line x1="9" y1="14" x2="15" y2="14"/>
                          </svg>
                          <span>{t('settings.noCache')}</span>
                        </div>
                      ) : (
                        <div className="files-list">
                          {cacheInfo.files.map((file, idx) => (
                            <div key={idx} className="file-item">
                              <div className="file-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                              </div>
                              <div className="file-info">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{formatFileSize(file.size)}</span>
                              </div>
                              <button 
                                className="file-delete"
                                onClick={() => handleDeleteFile(file.path)}
                                title={t('settings.deleteFile')}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <line x1="18" y1="6" x2="6" y2="18"/>
                                  <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="settings-section about-section">
                <div className="about-brand">
                  <div className="about-logo">
                    <img src="/assets/icons/icon.png" alt="Wildflover" />
                  </div>
                  <h3 className="about-title">
                    <span className="wild">Wild</span>
                    <span className="flower">flover</span>
                  </h3>
                  <p className="about-subtitle">{t('app.subtitle')}</p>
                </div>

                <div className="about-features">
                  <div className="feature-card">
                    <div className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <div className="feature-text">
                      <span className="feature-title">{t('settings.champions')}</span>
                      <span className="feature-desc">{t('settings.championsDesc')}</span>
                    </div>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                    </div>
                    <div className="feature-text">
                      <span className="feature-title">{t('settings.allSkins')}</span>
                      <span className="feature-desc">{t('settings.allSkinsDesc')}</span>
                    </div>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </div>
                    <div className="feature-text">
                      <span className="feature-title">{t('settings.favoritesSystem')}</span>
                      <span className="feature-desc">{t('settings.favoritesSystemDesc')}</span>
                    </div>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </div>
                    <div className="feature-text">
                      <span className="feature-title">{t('settings.oneClickApply')}</span>
                      <span className="feature-desc">{t('settings.oneClickApplyDesc')}</span>
                    </div>
                  </div>
                </div>

                <div className="about-footer">
                  <div className="about-info-row">
                    <span className="info-label">{t('settings.developer')}</span>
                    <span className="info-value highlight">Wildflover</span>
                  </div>
                  <div className="about-info-row">
                    <span className="info-label">{t('settings.platform')}</span>
                    <span className="info-value">Windows</span>
                  </div>
                </div>

                <p className="about-copyright">{t('settings.copyright')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* [CONFIRM-DIALOG] Cache clear confirmation dialog */}
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog-header">
              <div className="confirm-dialog-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="confirm-dialog-title">{t('settings.clearCacheTitle')}</h3>
            </div>
            <div className="confirm-dialog-content">
              <p className="confirm-dialog-message">{t('settings.clearCacheMessage')}</p>
              <div className="confirm-dialog-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <circle cx="12" cy="8" r="0.5" fill="currentColor"/>
                </svg>
                <span>{t('settings.clearCacheNote')}</span>
              </div>
            </div>
            <div className="confirm-dialog-actions">
              <button 
                className="confirm-dialog-btn cancel-btn"
                onClick={() => setShowConfirmDialog(false)}
              >
                {t('actions.cancel')}
              </button>
              <button 
                className="confirm-dialog-btn confirm-btn"
                onClick={handleConfirmClearCache}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>{t('settings.clearCache')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;

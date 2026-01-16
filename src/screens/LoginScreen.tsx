/**
 * File: LoginScreen.tsx
 * Author: Wildflover
 * Description: Discord OAuth2 login screen with guild verification and language selector
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import { discordAuth, getAvatarUrl, webhookService } from '../services/discord';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, type LanguageCode } from '../i18n';
import type { AuthStatus, DiscordUser } from '../types/discord';
import './LoginScreen.css';

// [CONFIG] Discord server invite URL
const DISCORD_INVITE_URL = 'https://discord.gg/QxJG4TENdD';

// [PROPS] Component property definitions
interface LoginScreenProps {
  onLoginSuccess: () => void;
  onAccessDenied: (reason: string) => void;
  isVerifying?: boolean;
  verifyingUser?: DiscordUser | null;
  verifyStatus?: 'verifying' | 'success' | 'error';
  rateLimitRemaining?: number;
}

// [COMPONENT] Discord login screen
const LoginScreen = ({ onLoginSuccess, onAccessDenied, isVerifying = false, verifyingUser, verifyStatus = 'verifying', rateLimitRemaining = 0 }: LoginScreenProps) => {
  const { t } = useTranslation();
  
  // Determine initial status based on props
  const getInitialStatus = (): AuthStatus => {
    if (rateLimitRemaining > 0) return 'rate_limited';
    if (isVerifying) {
      if (verifyStatus === 'success') return 'success';
      return 'verifying_guild';
    }
    return 'idle';
  };
  
  const [status, setStatus] = useState<AuthStatus>(getInitialStatus());
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<DiscordUser | null>(verifyingUser || null);
  const [guildName, setGuildName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(rateLimitRemaining);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getCurrentLanguage());
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // [EFFECT] Handle rate limit countdown
  useEffect(() => {
    if (discordAuth.isRateLimited()) {
      setStatus('rate_limited');
      setCountdown(discordAuth.getRateLimitRemaining());
    }
  }, []);

  // [EFFECT] Countdown timer for rate limit
  useEffect(() => {
    if (status !== 'rate_limited' || countdown <= 0) return;

    const timer = setInterval(() => {
      const remaining = discordAuth.getRateLimitRemaining();
      if (remaining <= 0) {
        setCountdown(0);
        setStatus('idle');
        setError(null);
        clearInterval(timer);
      } else {
        setCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status, countdown]);

  // [EFFECT] Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };

    if (showLangDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLangDropdown]);

  // [FUNC] Handle language change
  const handleLanguageChange = useCallback(async (langCode: LanguageCode) => {
    await changeLanguage(langCode);
    setCurrentLang(langCode);
    setShowLangDropdown(false);
    console.log('[LOGIN-LANG] Language changed to:', langCode);
  }, []);

  // [FUNC] Open Discord server invite
  const handleJoinDiscord = useCallback(async () => {
    try {
      await open(DISCORD_INVITE_URL);
      console.log('[LOGIN] Opening Discord invite');
    } catch (err) {
      console.error('[LOGIN] Failed to open Discord invite:', err);
      window.open(DISCORD_INVITE_URL, '_blank');
    }
  }, []);

  // [MEMO] Current language info
  const currentLangInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];
  }, [currentLang]);

  // [EFFECT] Handle external verification mode status changes
  useEffect(() => {
    if (isVerifying && verifyingUser) {
      setUser(verifyingUser);
      if (verifyStatus === 'success') {
        setStatus('success');
      } else {
        setStatus('verifying_guild');
      }
    } else if (!isVerifying) {
      // Not in verification mode - show idle or check for callback
      if (status === 'verifying_guild' && !user) {
        setStatus('idle');
      }
    }
  }, [isVerifying, verifyingUser, verifyStatus]);

  // [EFFECT] Check for existing auth or OAuth callback
  useEffect(() => {
    // Skip if in external verification mode - App.tsx handles verification
    if (isVerifying) {
      return;
    }

    const checkAuth = async () => {
      // Check URL for OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const errorParam = urlParams.get('error');

      // Clear URL params
      if (code || errorParam) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Handle OAuth error
      if (errorParam) {
        setError(t('login.oauthError'));
        setStatus('error');
        return;
      }

      // Handle OAuth callback
      if (code && state) {
        await handleOAuthCallback(code, state);
        return;
      }

      // Check existing authentication
      if (discordAuth.isAuthenticated()) {
        const existingUser = discordAuth.getUser();
        if (existingUser) {
          setUser(existingUser);
          await verifyGuildAccess();
        }
      }
    };

    checkAuth();
  }, [isVerifying]);

  // [FUNC] Handle OAuth callback
  const handleOAuthCallback = async (code: string, state: string) => {
    setStatus('authenticating');
    setError(null);

    try {
      const authState = await discordAuth.handleCallback(code, state);
      
      if (!authState.isAuthenticated || !authState.user) {
        throw new Error(authState.error || t('login.authFailed'));
      }

      setUser(authState.user);
      console.log('[LOGIN] User authenticated:', authState.user.username);
      
      // Verify guild membership
      await verifyGuildAccess();
    } catch (err) {
      console.error('[LOGIN] OAuth callback failed:', err);
      setError(err instanceof Error ? err.message : t('login.authFailed'));
      setStatus('error');
    }
  };

  // [FUNC] Verify guild access
  const verifyGuildAccess = async () => {
    setStatus('verifying_guild');

    try {
      const result = await discordAuth.verifyGuildMembership();
      
      if (result.success) {
        setGuildName(result.guildName || null);
        setStatus('success');
        console.log('[LOGIN] Guild access verified');
        
        // [CRITICAL] Save verification cache - prevents future API calls
        discordAuth.saveVerificationCache(true, result.guildName || null);
        console.log('[LOGIN] Verification cache saved - permanent access granted');
        
        // Send webhook notification for successful login
        const currentUser = discordAuth.getUser();
        if (currentUser) {
          console.log('[LOGIN] Sending webhook for user:', currentUser.username);
          webhookService.sendLoginNotification(currentUser).catch(err => {
            console.warn('[LOGIN] Webhook notification failed:', err);
          });
        } else {
          console.warn('[LOGIN] No user found for webhook');
        }
        
        // Delay before proceeding to splash
        setTimeout(() => {
          onLoginSuccess();
        }, 1500);
      } else {
        setStatus('guild_not_found');
        console.log('[LOGIN] Guild access denied');
        
        setTimeout(() => {
          onAccessDenied(result.error || t('login.guildRequired'));
        }, 2000);
      }
    } catch (err) {
      console.error('[LOGIN] Guild verification failed:', err);
      setError(err instanceof Error ? err.message : t('login.verificationFailed'));
      setStatus('error');
    }
  };

  // [FUNC] Initiate Discord login
  const handleLogin = useCallback(() => {
    setStatus('authenticating');
    setError(null);

    const { url } = discordAuth.initiateLogin();
    
    // Open Discord OAuth in same window
    window.location.href = url;
  }, []);

  // [FUNC] Retry login
  const handleRetry = useCallback(() => {
    // Use clearAllData for explicit retry - user wants fresh start
    discordAuth.clearAllData();
    setStatus('idle');
    setError(null);
    setUser(null);
    setGuildName(null);
  }, []);

  // [MEMO] Status message with i18n support
  const statusMessage = useMemo(() => {
    switch (status) {
      case 'authenticating':
        return t('login.authenticating');
      case 'verifying_guild':
        return t('login.verifyingGuild');
      case 'success':
        return t('login.success');
      case 'guild_not_found':
        return t('login.guildNotFound');
      case 'rate_limited':
        return t('login.rateLimited', { defaultValue: 'You are being rate limited. Please try again later.' });
      case 'error':
        return error || t('login.error');
      default:
        return t('login.welcome');
    }
  }, [status, error, t]);

  return (
    <div className="login-screen" data-tauri-drag-region>
      {/* [LANG-SELECTOR] Language selector in top-right corner */}
      <div className="login-lang-selector" ref={langDropdownRef}>
        <button 
          className="login-lang-btn"
          onClick={() => setShowLangDropdown(!showLangDropdown)}
          aria-label="Select language"
        >
          <svg className="lang-globe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span className="lang-code">{currentLangInfo.code.toUpperCase()}</span>
          <svg className={`lang-chevron ${showLangDropdown ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        
        {showLangDropdown && (
          <div className="login-lang-dropdown">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`login-lang-option ${currentLang === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span className="lang-code-badge">{lang.code.toUpperCase()}</span>
                <span className="lang-native">{lang.nativeName}</span>
                {currentLang === lang.code && (
                  <svg className="lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="login-content" data-tauri-drag-region>
        {/* [LOGO] Logo section */}
        <div className="login-logo-section">
          <div className="login-logo-container">
            <div className="login-logo-ring" />
            <div className="login-logo-core">
              <img src="/assets/icons/login_icon.jpg" alt="Wildflover Logo" />
            </div>
          </div>
          
          <div className="login-title-group">
            <h1 className="login-title">
              <span className="title-wild">Wild</span>
              <span className="title-flower">flover</span>
            </h1>
            <p className="login-subtitle">{t('app.skinManager')}</p>
          </div>
        </div>

        {/* [AUTH] Authentication section */}
        <div className="login-auth-section">
          {/* Idle state - Show login button */}
          {status === 'idle' && (
            <div className="login-idle">
              <p className="login-description">
                {t('login.description')}
              </p>
              <button className="login-discord-btn" onClick={handleLogin}>
                <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>{t('login.loginWithDiscord')}</span>
              </button>
              
              {/* [ACTIONS] Secondary action buttons */}
              <div className="login-secondary-actions">
                <button className="login-join-server-btn" onClick={handleJoinDiscord}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span>{t('login.joinServer')}</span>
                </button>
                <button className="login-help-btn" onClick={() => setShowHelpModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
                  </svg>
                  <span>{t('login.howToLogin')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Authenticating state */}
          {status === 'authenticating' && (
            <div className="login-loading">
              <div className="login-spinner" />
              <p className="login-status-text">{statusMessage}</p>
            </div>
          )}

          {/* Verifying guild state */}
          {status === 'verifying_guild' && (
            <div className="login-verifying">
              {user && (
                <div className="login-user-card">
                  <img 
                    className="login-avatar" 
                    src={getAvatarUrl(user.id, user.avatar, 128)} 
                    alt={user.username}
                  />
                  <div className="login-user-info">
                    <span className="login-username">{user.global_name || user.username}</span>
                    <span className="login-user-tag">@{user.username}</span>
                  </div>
                </div>
              )}
              <div className="login-spinner" />
              <p className="login-status-text">{statusMessage}</p>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <div className="login-success">
              {user && (
                <div className="login-user-card success">
                  <img 
                    className="login-avatar" 
                    src={getAvatarUrl(user.id, user.avatar, 128)} 
                    alt={user.username}
                  />
                  <div className="login-user-info">
                    <span className="login-username">{user.global_name || user.username}</span>
                    <span className="login-user-tag">@{user.username}</span>
                  </div>
                  <div className="login-check-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
              )}
              {guildName && (
                <p className="login-guild-name">{t('login.welcomeGuild', { guild: guildName })}</p>
              )}
              <p className="login-status-text success">{statusMessage}</p>
            </div>
          )}

          {/* Guild not found state */}
          {status === 'guild_not_found' && (
            <div className="login-denied">
              {user && (
                <div className="login-user-card denied">
                  <img 
                    className="login-avatar" 
                    src={getAvatarUrl(user.id, user.avatar, 128)} 
                    alt={user.username}
                  />
                  <div className="login-user-info">
                    <span className="login-username">{user.global_name || user.username}</span>
                    <span className="login-user-tag">@{user.username}</span>
                  </div>
                  <div className="login-denied-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </div>
                </div>
              )}
              <p className="login-status-text denied">{statusMessage}</p>
            </div>
          )}

          {/* Rate limited state */}
          {status === 'rate_limited' && (
            <div className="login-rate-limited">
              <div className="login-rate-limit-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <p className="login-status-text rate-limited">{statusMessage}</p>
              {countdown > 0 && (
                <div className="login-countdown">
                  <span className="countdown-value">{countdown}</span>
                  <span className="countdown-label">{t('login.secondsRemaining', { defaultValue: 'seconds remaining' })}</span>
                </div>
              )}
              <button 
                className="login-retry-btn" 
                onClick={handleRetry}
                disabled={countdown > 0}
              >
                {t('login.retry')}
              </button>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="login-error">
              <div className="login-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/>
                  <path d="M12 17h.01"/>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
              </div>
              <p className="login-status-text error">{statusMessage}</p>
              <button className="login-retry-btn" onClick={handleRetry}>
                {t('login.retry')}
              </button>
            </div>
          )}
        </div>

        {/* [FOOTER] Footer */}
        <div className="login-footer" data-tauri-drag-region>
          <span className="login-footer-text">by Wildflover</span>
        </div>
      </div>

      {/* [MODAL] Help Modal - How to login */}
      {showHelpModal && (
        <div className="login-help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="login-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h2>{t('login.helpTitle')}</h2>
              <button className="help-modal-close" onClick={() => setShowHelpModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="help-modal-content">
              <div className="help-step">
                <div className="help-step-number">1</div>
                <div className="help-step-content">
                  <h3>{t('login.helpStep1Title')}</h3>
                  <p>{t('login.helpStep1Desc')}</p>
                  <button className="help-join-btn" onClick={handleJoinDiscord}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
                    </svg>
                    {t('login.joinServer')}
                  </button>
                </div>
              </div>
              
              <div className="help-step">
                <div className="help-step-number">2</div>
                <div className="help-step-content">
                  <h3>{t('login.helpStep2Title')}</h3>
                  <p>{t('login.helpStep2Desc')}</p>
                </div>
              </div>
              
              <div className="help-step">
                <div className="help-step-number">3</div>
                <div className="help-step-content">
                  <h3>{t('login.helpStep3Title')}</h3>
                  <p>{t('login.helpStep3Desc')}</p>
                </div>
              </div>
              
              <div className="help-step">
                <div className="help-step-number">4</div>
                <div className="help-step-content">
                  <h3>{t('login.helpStep4Title')}</h3>
                  <p>{t('login.helpStep4Desc')}</p>
                </div>
              </div>
            </div>
            
            <div className="help-modal-footer">
              <button className="help-modal-done-btn" onClick={() => setShowHelpModal(false)}>
                {t('common.understood')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;

/**
 * File: App.tsx
 * Author: Wildflover
 * Description: Main application with Discord OAuth2 authentication and TopBar navigation
 * Language: TypeScript/React
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "./i18n";
import TitleBar from "./components/TitleBar";
import TopBar from "./components/TopBar";
import LoginScreen from "./screens/LoginScreen";
import AccessDeniedScreen from "./screens/AccessDeniedScreen";
import SplashScreen from "./screens/SplashScreen";
import DashboardScreen from "./screens/DashboardScreen";
import HomeScreen from "./screens/HomeScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import CustomsScreen from "./screens/CustomsScreen";
import MarketplaceScreen from "./screens/MarketplaceScreen";
import SettingsModal from "./components/SettingsModal";
import SelectionFab from "./components/SelectionFab";
import SelectedSkinsModal from "./components/SelectedSkinsModal";
import ActivationProgressModal from "./components/ActivationProgressModal";
import SkinSelector from "./components/SkinSelector";
import TutorialModal, { shouldShowTutorial } from "./components/TutorialModal";
import { useToast } from "./components/Toast";
import { championService, skinService, versionService, buildChampionSplashUrl, buildChampionIconUrl } from "./services/api";
import { discordAuth } from "./services/discord";
import { discordRpc } from "./services/discord/rpc";
import { webhookService } from "./services/discord/webhook";
import { discordEvents } from "./services/discord/events";
import { skinManager } from "./services/skinManager";
import { customsStorage } from "./services/customsStorage";
import { modActivator, SelectedSkinForDownload, CustomModForActivation, ActivationProgress } from "./services/modActivator";
import { imagePreloader } from "./services/imagePreloader";
import { ChampionFull, ChampionBasic, SkinData, DiscordUser } from "./types";
import "./App.css";

// [TYPE] View type definitions
type AppView = 'dashboard' | 'champions' | 'customs' | 'favorites' | 'marketplace' | 'settings';

// [TYPE] Application state definitions
type AppState = 'loading' | 'login' | 'splash' | 'main' | 'denied';

// [TYPE] Verification status for loading screen
type VerifyStatus = 'verifying' | 'success' | 'error';

// [CONSTANTS] Settings storage key
const SETTINGS_STORAGE_KEY = 'wildflover_settings';

// [COMPONENT] Main application component
function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('verifying');
  const [deniedReason, setDeniedReason] = useState<string>('');
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [showSelectedModal, setShowSelectedModal] = useState(false);
  const [selectedChampionFromModal, setSelectedChampionFromModal] = useState<ChampionFull | null>(null);
  const [champions, setChampions] = useState<ChampionFull[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  // [STATE] Activation progress modal
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationProgress, setActivationProgress] = useState<ActivationProgress | null>(null);
  const [activationSkins, setActivationSkins] = useState<SelectedSkinForDownload[]>([]);
  const [activationCustoms, setActivationCustoms] = useState<CustomModForActivation[]>([]);
  const preloadStarted = useRef(false);
  // [STATE] Tutorial modal for first-time users
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialChecked = useRef(false);
  
  // [TOAST] Toast notification hook
  const { showRateLimitToast } = useToast();

  // [EFFECT] Subscribe to Discord rate limit events for toast notifications
  useEffect(() => {
    const unsubscribe = discordEvents.on('rateLimit', (payload) => {
      const { seconds } = payload as { seconds: number };
      showRateLimitToast(seconds);
    });
    
    return () => unsubscribe();
  }, [showRateLimitToast]);

  // [EFFECT] Check existing authentication on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      // Check URL for OAuth callback first
      const urlParams = new URLSearchParams(window.location.search);
      const hasCallback = urlParams.has('code') || urlParams.has('error');
      
      if (hasCallback) {
        setAppState('login');
        return;
      }

      // Check if user has stored auth data
      if (!discordAuth.isAuthenticated()) {
        console.log('[APP-AUTH] No stored auth, showing login');
        setAppState('login');
        return;
      }

      // Get cached user for display during verification
      const cachedUser = discordAuth.getUser();
      if (cachedUser) {
        setDiscordUser(cachedUser);
      }

      // [CACHE-FIRST] Check verification cache BEFORE any API calls
      // PERMANENT: Once verified, NEVER re-verify - only check on first login
      const verificationCache = discordAuth.getVerificationCache();
      
      // If user was verified once, NEVER check again - permanent access
      if (verificationCache && verificationCache.verified) {
        console.log('[APP-AUTH] User previously verified - permanent access granted');
        
        // [FRESH-AVATAR] Refresh user data to get latest Discord avatar
        // This runs in background - doesn't block app startup
        discordAuth.refreshUserData().then((freshUser) => {
          if (freshUser) {
            console.log('[APP-AUTH] Fresh user data loaded:', freshUser.username);
            setDiscordUser(freshUser);
          }
        }).catch((err) => {
          console.warn('[APP-AUTH] Fresh user data fetch failed, using cached:', err);
        });
        
        // Show "Access Verified" animation for modern UX
        setVerifyStatus('success');
        // Brief delay to show verification success animation
        setTimeout(() => setAppState('splash'), 1200);
        return;
      }

      // Check if token rate limited
      if (discordAuth.isRateLimited()) {
        console.log('[APP-AUTH] Token rate limited, showing login');
        setAppState('login');
        return;
      }

      console.log('[APP-AUTH] Proceeding with role verification...');
      
      try {
        // Check if token is still valid WITHOUT making API call
        const tokenStillValid = discordAuth.isTokenValid();
        
        if (tokenStillValid) {
          console.log('[APP-AUTH] Token still valid, using cached data');
          // Token valid - use cached user data, skip unnecessary API calls
          const user = discordAuth.getUser();
          if (user) {
            setDiscordUser(user);
            console.log('[APP-AUTH] Using cached user:', user.username);
            
            // Verify guild membership with timeout
            console.log('[APP-AUTH] Verifying guild membership...');
            const roleResult = await Promise.race([
              discordAuth.verifyGuildMembership(),
              new Promise<{ success: false; error: string }>((resolve) => 
                setTimeout(() => resolve({ success: false, error: 'Verification timeout' }), 10000)
              )
            ]);
            
            if (!roleResult.success) {
              console.log('[APP-AUTH] Role verification failed:', roleResult.error);
              
              // [RATE-LIMIT-FALLBACK] On rate limit/throttle/timeout, ALWAYS use cache
              if (roleResult.error === 'RATE_LIMITED' || roleResult.error === 'THROTTLED' || roleResult.error === 'Verification timeout') {
                const cachedVerification = discordAuth.getVerificationCache();
                // Accept ANY valid cache on rate limit - no time limit
                if (cachedVerification && cachedVerification.verified) {
                  console.log('[APP-AUTH] Rate limited/timeout - using cached verification, proceeding...');
                  setVerifyStatus('success');
                  setTimeout(() => setAppState('splash'), 300);
                  return;
                }
                // No cache at all - show friendly message but don't clear auth
                if (roleResult.error === 'Verification timeout') {
                  setDeniedReason('Connection timeout. Please check your internet and try again.');
                } else {
                  setDeniedReason('Too many requests. Please wait a few minutes and try again.');
                }
                setAppState('denied');
                return;
              }
              
              // Real auth failure - clear auth
              discordAuth.clearAuth();
              setDeniedReason(roleResult.error || 'You don\'t have access permission.');
              setAppState('denied');
              return;
            }

            // Save successful verification to cache
            discordAuth.saveVerificationCache(true, roleResult.guildName || null);

            // Send login webhook notification
            webhookService.sendLoginNotification(user).catch(err => {
              console.warn('[APP-AUTH] Login webhook failed:', err);
            });

            console.log('[APP-AUTH] Access verified, proceeding to splash');
            setVerifyStatus('success');
            setTimeout(() => setAppState('splash'), 1500);
            return;
          }
        }

        // Token expired - need to refresh
        console.log('[APP-AUTH] Token expired, attempting refresh...');
        const hasValidToken = await discordAuth.ensureValidToken();
        console.log('[APP-AUTH] Token valid:', hasValidToken);
        
        if (!hasValidToken) {
          console.log('[APP-AUTH] Could not obtain valid token, showing login');
          // Don't clear auth if rate limited - user can retry later
          if (!discordAuth.isRateLimited()) {
            discordAuth.clearAuth();
          }
          setAppState('login');
          return;
        }

        // Get user data (refresh or use cached)
        console.log('[APP-AUTH] Refreshing user data...');
        let user = await discordAuth.refreshUserData();
        if (!user) {
          user = discordAuth.getUser();
        }
        
        if (!user) {
          console.log('[APP-AUTH] No user data available, showing login');
          discordAuth.clearAuth();
          setAppState('login');
          return;
        }

        setDiscordUser(user);
        console.log('[APP-AUTH] User loaded:', user.username);

        // Verify role access
        console.log('[APP-AUTH] Verifying guild membership...');
        const roleResult = await discordAuth.verifyGuildMembership();
        console.log('[APP-AUTH] Guild verification result:', roleResult);
        
        if (!roleResult.success) {
          console.log('[APP-AUTH] Role verification failed:', roleResult.error);
          discordAuth.clearAuth();
          setDeniedReason(roleResult.error || 'You don\'t have access permission.');
          setAppState('denied');
          return;
        }

        console.log('[APP-AUTH] Access verified, proceeding to splash');
        setVerifyStatus('success');
        
        // Show success state briefly before splash
        setTimeout(() => {
          setAppState('splash');
        }, 1500);
        
      } catch (error) {
        console.error('[APP-AUTH] Verification error:', error);
        // Don't clear auth on network errors if rate limited
        if (!discordAuth.isRateLimited()) {
          discordAuth.clearAuth();
        }
        setAppState('login');
      }
    };

    checkExistingAuth();
  }, []);

  // [EFFECT] Control minimize to tray based on app state
  // Disable during login/splash, enable only in main app
  useEffect(() => {
    const isMainApp = appState === 'main';
    
    if (isMainApp) {
      // [MAIN-APP] Restore user's minimize to tray preference
      try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          const minimizeToTray = settings.minimizeToTray ?? false;
          invoke('set_minimize_to_tray', { enabled: minimizeToTray }).catch((err) => {
            console.warn('[APP-SETTINGS] Failed to sync tray setting:', err);
          });
          console.log('[APP-SETTINGS] Minimize to tray enabled:', minimizeToTray);
        }
      } catch (e) {
        console.warn('[APP-SETTINGS] Failed to load settings');
      }
    } else {
      // [LOGIN/SPLASH] Disable minimize to tray - close should exit app
      invoke('set_minimize_to_tray', { enabled: false }).catch((err) => {
        console.warn('[APP-SETTINGS] Failed to disable tray:', err);
      });
      console.log('[APP-SETTINGS] Minimize to tray disabled for:', appState);
    }
  }, [appState]);

  // [EFFECT] Check overlay status on app start
  useEffect(() => {
    if (appState === 'main') {
      modActivator.checkOverlayStatus().then(running => {
        setIsOverlayActive(running);
        console.log('[APP-OVERLAY] Initial status:', running ? 'ACTIVE' : 'INACTIVE');
      });
    }
  }, [appState]);

  // [FUNC] Load remaining skins in background
  const loadRemainingSkins = useCallback(async (remainingChampions: ChampionBasic[]) => {
    const batchSize = 10;
    const selectedSkinsMap = skinManager.getAllSelectedSkins();
    
    for (let i = 0; i < remainingChampions.length; i += batchSize) {
      const batch = remainingChampions.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(c => skinService.fetchSkins(c.key))
      );
      
      setChampions(prev => {
        const updated = [...prev];
        batch.forEach((champ, idx) => {
          const champIndex = updated.findIndex(c => c.id === champ.key);
          if (champIndex !== -1 && results[idx].length > 0) {
            // Check if this champion has a selected skin
            const selectedSkinId = selectedSkinsMap.get(champ.key);
            let splashUrl = updated[champIndex].splashUrl;
            
            if (selectedSkinId) {
              // Find selected skin and use its splash
              const selectedSkin = results[idx].find((s: SkinData) => s.id === selectedSkinId);
              if (selectedSkin) {
                splashUrl = selectedSkin.splashPath || splashUrl;
              }
            } else {
              // No selection - use base skin
              const baseSkin = results[idx].find((s: SkinData) => s.isBase) || results[idx][0];
              splashUrl = baseSkin.splashPath || splashUrl;
            }
            
            updated[champIndex] = {
              ...updated[champIndex],
              skins: results[idx],
              splashUrl
            };
          }
        });
        return updated;
      });
    }
    
    console.log('[APP-PRELOAD] Background skin loading complete');
  }, []);

  // [EFFECT] Listen for language changes and reload all data
  useEffect(() => {
    if (appState !== 'main') return;
    
    const handleLanguageChange = async (newLang: string) => {
      console.log('[APP-LOCALE] Language changed to:', newLang);
      
      try {
        // [STEP-1] Clear caches for fresh locale data
        skinService.clearCache();
        championService.clearCache();
        
        // [STEP-2] Set new locale for skin service
        skinService.setLocale(newLang);
        
        // [STEP-3] Fetch fresh champion data with new locale
        const basicChampions = await championService.fetchChampions(newLang);
        
        console.log('[APP-LOCALE] Updating champion names with locale:', newLang);
        
        // [STEP-4] Update ONLY name and title - preserve everything else (no flicker)
        setChampions(prev => {
          return prev.map(champ => {
            const newData = basicChampions.find((b: ChampionBasic) => b.key === champ.id);
            if (newData) {
              return {
                ...champ,
                name: newData.name,
                title: newData.title
                // Keep: skins, splashUrl, iconUrl - no change
              };
            }
            return champ;
          });
        });
        
        // [STEP-5] Reload skins in background for new locale names (skin names)
        const selectedSkinsMap = skinManager.getAllSelectedSkins();
        const priorityChampions = basicChampions.slice(0, 30);
        
        // Background skin reload - no state flicker
        Promise.all(
          priorityChampions.map((c: ChampionBasic) => skinService.fetchSkins(c.key))
        ).then(skinResults => {
          setChampions(prev => {
            const updated = [...prev];
            priorityChampions.forEach((champ: ChampionBasic, idx: number) => {
              const champIndex = updated.findIndex(c => c.id === champ.key);
              if (champIndex !== -1 && skinResults[idx].length > 0) {
                const selectedSkinId = selectedSkinsMap.get(champ.key);
                let splashUrl = updated[champIndex].splashUrl;
                
                if (selectedSkinId) {
                  const selectedSkin = skinResults[idx].find((s: SkinData) => s.id === selectedSkinId);
                  if (selectedSkin) {
                    splashUrl = selectedSkin.splashPath || splashUrl;
                  }
                }
                
                updated[champIndex] = {
                  ...updated[champIndex],
                  skins: skinResults[idx],
                  splashUrl
                };
              }
            });
            return updated;
          });
          
          // Load remaining skins
          loadRemainingSkins(basicChampions.slice(30));
        });
        
        console.log('[APP-LOCALE] Locale update complete:', newLang);
        
      } catch (error) {
        console.error('[APP-LOCALE] Failed to reload data:', error);
      }
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [appState, loadRemainingSkins]);

  // [EFFECT] Preload champion data during splash
  useEffect(() => {
    if (appState !== 'splash' || preloadStarted.current) return;
    preloadStarted.current = true;

    const preloadData = async () => {
      try {
        console.log('[APP-PRELOAD] Starting data preload...');
        
        // [LOCALE] Use current i18n language instead of hardcoded 'en'
        const currentLocale = i18n.language || 'en';
        console.log('[APP-PRELOAD] Using locale:', currentLocale);
        
        // Set skin service locale before fetching
        skinService.setLocale(currentLocale);
        
        await versionService.fetchLatest();
        const version = versionService.getVersion();
        
        const basicChampions = await championService.fetchChampions(currentLocale);
        console.log(`[APP-PRELOAD] Champions loaded: ${basicChampions.length}`);
        
        // Transform to ChampionFull with DDragon splash URLs
        const fullChampions: ChampionFull[] = basicChampions.map((c: ChampionBasic) => ({
          id: c.key,
          key: c.id,
          name: c.name,
          title: c.title,
          skins: [],
          splashUrl: buildChampionSplashUrl(c.id, 0),
          iconUrl: buildChampionIconUrl(version, c.id)
        }));
        
        setChampions(fullChampions);
        
        // [PRIORITY] Preload first 30 champions' skins for instant display
        const priorityChampions = basicChampions.slice(0, 30);
        const skinResults = await Promise.all(
          priorityChampions.map((c: ChampionBasic) => skinService.fetchSkins(c.key))
        );
        
        // Update champions with loaded skins
        setChampions(prev => {
          const updated = [...prev];
          priorityChampions.forEach((champ: ChampionBasic, idx: number) => {
            const champIndex = updated.findIndex(c => c.id === champ.key);
            if (champIndex !== -1 && skinResults[idx].length > 0) {
              const baseSkin = skinResults[idx].find((s: SkinData) => s.isBase) || skinResults[idx][0];
              updated[champIndex] = {
                ...updated[champIndex],
                skins: skinResults[idx],
                splashUrl: baseSkin.splashPath || updated[champIndex].splashUrl
              };
            }
          });
          return updated;
        });
        
        setIsDataReady(true);
        console.log('[APP-PRELOAD] Data preload complete');
        
        // [BACKGROUND] Load remaining skins in background
        loadRemainingSkins(basicChampions.slice(30));
        
      } catch (error) {
        console.error('[APP-PRELOAD] Preload failed:', error);
        setIsDataReady(true); // Allow app to continue even on error
      }
    };

    preloadData();
  }, [appState, loadRemainingSkins]);

  // [EFFECT] Start image preloading after all skins are loaded
  useEffect(() => {
    // Only start preloading when we have champions with skins loaded
    const championsWithSkins = champions.filter(c => c.skins.length > 0);
    if (championsWithSkins.length >= 50 && !imagePreloader.getStatus().isComplete) {
      console.log('[APP-PRELOAD] Starting background image preload...');
      imagePreloader.preloadAllChampions(championsWithSkins);
    }
  }, [champions]);

  // [HANDLER] Update champions from HomeScreen
  const handleChampionsUpdate = useCallback((updatedChampions: ChampionFull[]) => {
    setChampions(updatedChampions);
  }, []);

  // [HANDLER] Login success - proceed to splash
  const handleLoginSuccess = useCallback(() => {
    console.log('[APP-AUTH] Login successful, showing splash');
    const user = discordAuth.getUser();
    if (user) setDiscordUser(user);
    setAppState('splash');
  }, []);

  // [HANDLER] Access denied - show denied screen and clear auth
  const handleAccessDenied = useCallback((reason: string) => {
    console.log('[APP-AUTH] Access denied:', reason);
    // Clear auth data so user won't be auto-redirected to splash on next app start
    discordAuth.clearAuth();
    setDeniedReason(reason);
    setAppState('denied');
  }, []);

  // [HANDLER] Retry from denied screen
  const handleRetryLogin = useCallback(() => {
    console.log('[APP-AUTH] Retrying login');
    preloadStarted.current = false;
    setDiscordUser(null);
    setAppState('login');
  }, []);

  // [HANDLER] Logout - clear auth and return to login
  const handleLogout = useCallback(async () => {
    console.log('[APP-AUTH] Logout initiated');
    
    // Get user BEFORE any auth clearing operations
    const user = discordAuth.getUser();
    console.log('[APP-AUTH] User for logout webhook:', user ? user.username : 'NULL');
    
    // Send logout webhook before clearing auth
    if (user) {
      try {
        console.log('[APP-AUTH] Sending logout webhook...');
        const result = await webhookService.sendLogoutNotification(user);
        console.log('[APP-AUTH] Logout webhook result:', result);
      } catch (err) {
        console.error('[APP-AUTH] Logout webhook error:', err);
      }
    } else {
      console.warn('[APP-AUTH] No user data available for logout webhook');
    }
    
    // Clear auth and Discord RPC after webhook sent
    console.log('[APP-AUTH] Clearing auth data...');
    await discordAuth.logout();
    discordRpc.disable();
    
    preloadStarted.current = false;
    setDiscordUser(null);
    setAppState('login');
    console.log('[APP-AUTH] Logout complete');
  }, []);

  // [HANDLER] Reset all selections - also reset champion splash URLs to base skin
  const handleResetAllSelections = useCallback(() => {
    skinManager.clearAllSelections();
    customsStorage.deactivateAll();
    
    // [SPLASH-RESET] Reset all champion splashUrls to base skin
    setChampions(prev => prev.map(champ => {
      if (champ.skins && champ.skins.length > 0) {
        const baseSkin = champ.skins.find(s => s.isBase) || champ.skins[0];
        return {
          ...champ,
          splashUrl: baseSkin.splashPath || champ.splashUrl
        };
      }
      return champ;
    }));
  }, []);

  // [HANDLER] Activate all selected mods
  const handleActivateMods = useCallback(async () => {
    console.log('[APP-ACTIVATE] handleActivateMods called, isActivating:', isActivating);
    if (isActivating) {
      console.log('[APP-ACTIVATE] Already activating, returning...');
      return;
    }
    
    setIsActivating(true);
    console.log('[APP-ACTIVATE] Starting mod activation...');
    console.log('[APP-ACTIVATE] Champions count:', champions.length);
    
    // Build selected skins list
    const selectedSkins: SelectedSkinForDownload[] = [];
    const selectedMap = skinManager.getAllSelectedSkins();
    console.log('[APP-ACTIVATE] Selected skins map size:', selectedMap.size);
    console.log('[APP-ACTIVATE] Selected skins map:', Array.from(selectedMap.entries()));
    
    selectedMap.forEach((skinId, championId) => {
      console.log('[APP-ACTIVATE] Processing championId:', championId, 'skinId:', skinId);
      const champion = champions.find(c => c.id === championId);
      if (!champion) {
        console.log('[APP-ACTIVATE] Champion not found:', championId);
        return;
      }
      console.log('[APP-ACTIVATE] Champion found:', champion.name, 'skins count:', champion.skins.length);
      
      const skin = champion.skins.find(s => s.id === skinId);
      if (!skin) {
        console.log('[APP-ACTIVATE] Skin not found:', skinId, 'in champion:', champion.name);
        return;
      }
      console.log('[APP-ACTIVATE] Skin found:', skin.name);
      
      // [EXTRACT] Get chroma selection if exists - verify it matches current skin
      const chroma = skinManager.getSelectedChroma(championId);
      const isChromaValid = chroma && chroma.skinId === skinId;
      const chromaData = isChromaValid ? skin.chromas.find(c => c.id === chroma.chromaId) : undefined;
      
      // [EXTRACT] Get form selection if exists - verify it matches current skin
      const form = skinManager.getSelectedForm(championId);
      const isFormValid = form && form.skinId === skinId;
      const formData = isFormValid ? skin.forms?.find(f => f.id === form.formId) : undefined;
      
      // [EXTRACT] Get only chroma variant name from full name (e.g. "Skin Name (Chroma)" -> "Chroma")
      let chromaDisplayName: string | undefined;
      if (chromaData?.name) {
        const match = chromaData.name.match(/\(([^)]+)\)$/);
        chromaDisplayName = match ? match[1] : chromaData.name;
      }
      
      selectedSkins.push({
        championId,
        championName: champion.name,
        skinId,
        skinName: skin.name,
        chromaId: isChromaValid ? chroma.chromaId : undefined,
        chromaName: chromaDisplayName,
        chromaColor: chromaData?.colors?.[0],
        formId: isFormValid ? form.formId : undefined,
        formName: formData?.name,
        splashUrl: skin.tilePath || skin.splashPath,
        iconUrl: champion.iconUrl
      });
    });
    
    // [CUSTOMS] Build custom mods list with thumbnails from IndexedDB
    const activeMods = customsStorage.getActiveMods();
    const customMods: CustomModForActivation[] = [];
    
    // Load thumbnails from IndexedDB for each active mod
    for (const mod of activeMods) {
      const thumbnail = await customsStorage.getThumbnail(mod.id);
      customMods.push({
        id: mod.id,
        name: mod.displayName,
        path: mod.filePath,
        thumbnail: thumbnail || undefined
      });
    }
    
    const totalItems = selectedSkins.length + customMods.length;
    console.log('[APP-ACTIVATE] Skins:', selectedSkins.length, 'Customs:', customMods.length, 'Total:', totalItems);
    
    // [CHECK] If no items, show error and return
    if (totalItems === 0) {
      console.log('[APP-ACTIVATE] No items to activate!');
      setIsActivating(false);
      return;
    }
    
    // [MODAL] Show activation progress modal
    setActivationSkins(selectedSkins);
    setActivationCustoms(customMods);
    setActivationProgress({ stage: 'detecting', current: 0, total: totalItems, message: 'Initializing...' });
    setShowActivationModal(true);
    
    // [IMMEDIATE] Start activation
    console.log('[APP-ACTIVATE] Calling modActivator...');
    
    // Activate mods with progress callback
    const result = await modActivator.activateMods(
      selectedSkins,
      customMods,
      (progress) => {
        console.log('[APP-ACTIVATE] Progress:', progress.stage, progress.message);
        setActivationProgress(progress);
      }
    );
    
    if (result.success) {
      console.log('[APP-ACTIVATE] Activation successful');
      setIsOverlayActive(true);
      setActivationProgress({ stage: 'complete', current: totalItems, total: totalItems, message: 'All mods activated!' });
    } else {
      console.error('[APP-ACTIVATE] Activation failed:', result.error);
      setIsOverlayActive(false);
      setActivationProgress({ stage: 'error', current: 0, total: totalItems, message: result.error || 'Activation failed' });
    }
    
    // Clear activating state after delay
    setTimeout(() => {
      setIsActivating(false);
    }, 1000);
  }, [champions, isActivating]);

  // [HANDLER] Close activation modal
  const handleCloseActivationModal = useCallback(() => {
    setShowActivationModal(false);
    setActivationProgress(null);
  }, []);

  // [HANDLER] Stop overlay
  const handleStopOverlay = useCallback(async () => {
    const success = await modActivator.stopOverlay();
    if (success) {
      setIsOverlayActive(false);
    }
  }, []);

  // [HANDLER] Splash screen completion
  const handleSplashComplete = () => {
    setAppState('main');
    // Initialize Discord RPC when entering main app
    discordRpc.initialize().then(() => {
      discordRpc.setPage('DASHBOARD');
    });
    console.log('[APP-INIT] Splash completed, entering main app');
  };

  // [EFFECT] Check if tutorial should be shown for first-time users
  useEffect(() => {
    if (appState === 'main' && !tutorialChecked.current) {
      tutorialChecked.current = true;
      
      // Check if this is first-time user
      if (shouldShowTutorial()) {
        console.log('[APP-TUTORIAL] First-time user detected, showing tutorial');
        // Delay tutorial to allow main app to render first
        setTimeout(() => {
          setShowTutorial(true);
        }, 800);
      } else {
        console.log('[APP-TUTORIAL] Tutorial already completed, skipping');
      }
    }
  }, [appState]);

  // [HANDLER] View change
  const handleViewChange = (view: AppView) => {
    if (view === 'settings') {
      setShowSettings(true);
      discordRpc.setPage('SETTINGS');
    } else {
      setCurrentView(view);
      // Update Discord RPC based on view
      const rpcPageMap: Record<AppView, 'DASHBOARD' | 'HOME' | 'CUSTOMS' | 'FAVORITES' | 'MARKETPLACE' | 'SETTINGS'> = {
        dashboard: 'DASHBOARD',
        champions: 'HOME',
        customs: 'CUSTOMS',
        favorites: 'FAVORITES',
        marketplace: 'MARKETPLACE',
        settings: 'SETTINGS'
      };
      discordRpc.setPage(rpcPageMap[view]);
    }
  };

  // [RENDER] Loading/Verifying state - show verification screen
  if (appState === 'loading') {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess} 
        onAccessDenied={handleAccessDenied}
        isVerifying={true}
        verifyingUser={discordUser}
        verifyStatus={verifyStatus}
      />
    );
  }

  // [RENDER] Login screen
  if (appState === 'login') {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess} 
        onAccessDenied={handleAccessDenied} 
      />
    );
  }

  // [RENDER] Access denied screen
  if (appState === 'denied') {
    return (
      <AccessDeniedScreen 
        reason={deniedReason} 
        onRetry={handleRetryLogin} 
      />
    );
  }

  // [RENDER] Splash screen
  if (appState === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // [RENDER] Main application
  return (
    <div className="app">
      <TitleBar onHelpClick={() => setShowTutorial(true)} />
      
      <TopBar
        currentView={currentView}
        onViewChange={handleViewChange}
        discordUser={discordUser}
        onLogout={handleLogout}
      />

      <div className="app-content">
        {currentView === 'dashboard' && <DashboardScreen />}
        {currentView === 'champions' && (
          <HomeScreen 
            champions={champions} 
            onChampionsUpdate={handleChampionsUpdate}
            isDataReady={isDataReady}
            isLocked={isOverlayActive}
          />
        )}
        {currentView === 'customs' && <CustomsScreen isLocked={isOverlayActive} />}
        {currentView === 'favorites' && <FavoritesScreen champions={champions} isLocked={isOverlayActive} />}
        {currentView === 'marketplace' && (
          <MarketplaceScreen 
            discordUserId={discordUser?.id}
            discordUsername={discordUser?.username}
            discordDisplayName={discordUser?.global_name || discordUser?.username}
            discordAvatar={discordUser?.avatar}
          />
        )}
      </div>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => {
          setShowSettings(false);
          // Restore RPC to current view when settings closes
          const rpcPageMap: Record<AppView, 'DASHBOARD' | 'HOME' | 'CUSTOMS' | 'FAVORITES' | 'MARKETPLACE' | 'SETTINGS'> = {
            dashboard: 'DASHBOARD',
            champions: 'HOME',
            customs: 'CUSTOMS',
            favorites: 'FAVORITES',
            marketplace: 'MARKETPLACE',
            settings: 'SETTINGS'
          };
          discordRpc.setPage(rpcPageMap[currentView]);
        }}
        onResetSelections={handleResetAllSelections}
      />

      {/* [FAB] Global selection floating button */}
      <SelectionFab 
        onClick={() => setShowSelectedModal(true)}
        onReset={handleResetAllSelections}
        onActivate={handleActivateMods}
        onStop={handleStopOverlay}
        overlayActive={isOverlayActive}
        isLocked={isOverlayActive}
      />

      {/* [MODAL] Selected skins modal */}
      {showSelectedModal && (
        <SelectedSkinsModal
          champions={champions}
          onClose={() => setShowSelectedModal(false)}
          onResetAll={handleResetAllSelections}
          onChampionSelect={(champion) => {
            setShowSelectedModal(false);
            setSelectedChampionFromModal(champion);
          }}
          isLocked={isOverlayActive}
        />
      )}

      {/* [SKIN-SELECTOR] Global skin selector from modal */}
      {selectedChampionFromModal && (
        <SkinSelector
          champion={selectedChampionFromModal}
          onClose={() => setSelectedChampionFromModal(null)}
          isLocked={isOverlayActive}
        />
      )}

      {/* [ACTIVATION-MODAL] Activation progress modal */}
      <ActivationProgressModal
        isOpen={showActivationModal}
        progress={activationProgress}
        selectedSkins={activationSkins}
        customMods={activationCustoms}
        onClose={handleCloseActivationModal}
      />

      {/* [TUTORIAL-MODAL] First-time user tutorial guide */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
}

export default App;

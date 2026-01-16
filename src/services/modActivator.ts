/**
 * File: modActivator.ts
 * Author: Wildflover
 * Description: Frontend service for mod download and activation via Tauri backend
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';

// [INTERFACE] Skin download request
interface SkinDownloadRequest {
  champion_id: number;
  skin_id: number;
  chroma_id?: number;
  form_id?: number;
}

// [INTERFACE] Download result from backend
interface DownloadResult {
  success: boolean;
  path?: string;
  error?: string;
}

// [INTERFACE] Mod item for activation
interface ModItem {
  name: string;
  path: string;
  is_custom: boolean;
}

// [INTERFACE] Activation result from backend
interface ActivationResult {
  success: boolean;
  message: string;
  error?: string;
  vanguard_blocked: boolean;
}

// [INTERFACE] DLL Fix status from backend
interface DllFixStatus {
  is_applied: boolean;
  version: string | null;
  latest_version: string | null;
  last_check_hours_ago: number | null;
  dll_exists: boolean;
  needs_update: boolean;
}

// [INTERFACE] System diagnostic from backend
interface SystemDiagnostic {
  managers_dir_found: boolean;
  managers_dir_path: string | null;
  mod_tools_exists: boolean;
  dll_exists: boolean;
  dll_size: number;
  game_path: string | null;
  overlay_status: string;
  cslol_version: string | null;
  profile_dir_exists: boolean;
  profile_file_count: number;
  installed_mod_count: number;
}

// [INTERFACE] Selected skin for download
export interface SelectedSkinForDownload {
  championId: number;
  championName: string;
  skinId: number;
  skinName: string;
  chromaId?: number;
  chromaName?: string;
  chromaColor?: string;
  formId?: number;
  formName?: string;
  splashUrl?: string;
  iconUrl?: string;
}

// [INTERFACE] Custom mod for activation
export interface CustomModForActivation {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
}

// [INTERFACE] Activation progress callback
export interface ActivationProgress {
  stage: 'detecting' | 'downloading' | 'preparing' | 'activating' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
  vanguardBlocked?: boolean;
  currentItemIndex?: number;
  completedItems?: number[];
}

/**
 * Mod Activator Service
 * Handles skin downloads from GitHub and mod activation via mod-tools.exe
 * Optimized for instant re-activation with smart caching
 */
class ModActivatorService {
  private gamePath: string | null = null;
  private isActivating: boolean = false;
  private overlayRunning: boolean = false;
  private lastSelectionHash: string | null = null;
  private cachedModPaths: Map<string, string> = new Map(); // skinKey -> path

  /**
   * Detect League of Legends game path
   */
  async detectGamePath(): Promise<string | null> {
    try {
      const path = await invoke<string | null>('detect_game_path');
      this.gamePath = path;
      console.log('[MOD-ACTIVATOR] Game path:', path || 'Not found');
      return path;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Failed to detect game path:', error);
      return null;
    }
  }

  /**
   * Set game path manually via backend
   */
  async setManualGamePath(path: string): Promise<boolean> {
    try {
      const result = await invoke<boolean>('set_game_path', { path });
      if (result) {
        this.gamePath = path;
        console.log('[MOD-ACTIVATOR] Manual game path set:', path);
      }
      return result;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Failed to set game path:', error);
      return false;
    }
  }

  /**
   * Browse for game folder using native dialog
   */
  async browseGamePath(): Promise<string | null> {
    try {
      const path = await invoke<string | null>('browse_game_path');
      console.log('[MOD-ACTIVATOR] Browse result:', path || 'Cancelled');
      return path;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Failed to browse game path:', error);
      return null;
    }
  }

  /**
   * Clear saved game path - revert to auto-detect
   */
  async clearGamePath(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('clear_game_path');
      if (result) {
        this.gamePath = null;
        console.log('[MOD-ACTIVATOR] Game path cleared');
      }
      return result;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Failed to clear game path:', error);
      return false;
    }
  }

  /**
   * Set game path manually (legacy - for direct assignment)
   */
  setGamePath(path: string): void {
    this.gamePath = path;
    console.log('[MOD-ACTIVATOR] Game path set manually:', path);
  }

  /**
   * Get current game path
   */
  getGamePath(): string | null {
    return this.gamePath;
  }

  /**
   * Download a single skin from GitHub - with local cache check
   */
  async downloadSkin(request: SkinDownloadRequest): Promise<DownloadResult> {
    // [CACHE-KEY] Generate unique key for this skin - include form_id if present
    let cacheKey: string;
    if (request.chroma_id) {
      cacheKey = `${request.champion_id}_${request.skin_id}_chroma_${request.chroma_id}`;
    } else if (request.form_id) {
      cacheKey = `${request.champion_id}_${request.skin_id}_form_${request.form_id}`;
    } else {
      cacheKey = `${request.champion_id}_${request.skin_id}`;
    }
    
    // [FAST-PATH] Check memory cache first
    if (this.cachedModPaths.has(cacheKey)) {
      const cachedPath = this.cachedModPaths.get(cacheKey)!;
      console.log('[MOD-ACTIVATOR] Memory cache hit:', cacheKey);
      return { success: true, path: cachedPath };
    }
    
    try {
      console.log('[MOD-ACTIVATOR] Downloading skin:', cacheKey);
      const result = await invoke<DownloadResult>('download_skin', { request });
      
      // [CACHE] Store successful download path
      if (result.success && result.path) {
        this.cachedModPaths.set(cacheKey, result.path);
      }
      
      return result;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Download failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Generate selection hash for cache validation
   * Includes form_id for tiered skins
   */
  private generateSelectionHash(skins: SelectedSkinForDownload[], customs: CustomModForActivation[]): string {
    const skinKeys = skins.map(s => {
      if (s.formId) {
        return `${s.championId}_${s.skinId}_form_${s.formId}`;
      } else if (s.chromaId) {
        return `${s.championId}_${s.skinId}_chroma_${s.chromaId}`;
      }
      return `${s.championId}_${s.skinId}`;
    }).sort();
    const customKeys = customs.map(c => c.id).sort();
    return [...skinKeys, ...customKeys].join('|');
  }

  /**
   * Activate mods using mod-tools.exe
   * Optimized for instant re-activation with parallel downloads
   */
  async activateMods(
    skins: SelectedSkinForDownload[],
    customs: CustomModForActivation[],
    onProgress?: (progress: ActivationProgress) => void
  ): Promise<ActivationResult> {
    if (this.isActivating) {
      return {
        success: false,
        message: '',
        error: 'Activation already in progress',
        vanguard_blocked: false
      };
    }

    this.isActivating = true;
    const startTime = Date.now();

    try {
      const totalItems = skins.length + customs.length;
      
      // [FAST-PATH] Check if same selection - backend will use cached profile
      const currentHash = this.generateSelectionHash(skins, customs);
      const isSameSelection = this.lastSelectionHash === currentHash;
      
      if (isSameSelection) {
        console.log('[MOD-ACTIVATOR] Same selection detected - using fast path');
      }

      // [STAGE-1] Detect game path (cached after first call)
      onProgress?.({
        stage: 'detecting',
        current: 0,
        total: totalItems,
        message: 'Detecting game path...'
      });

      if (!this.gamePath) {
        await this.detectGamePath();
      }

      if (!this.gamePath) {
        return {
          success: false,
          message: '',
          error: 'League of Legends game path not found. Please set it manually in settings.',
          vanguard_blocked: false
        };
      }

      // [STAGE-2] Download skins - PARALLEL for speed
      const completedItems: number[] = [];
      
      onProgress?.({
        stage: 'downloading',
        current: 0,
        total: totalItems,
        message: 'Preparing mods...',
        currentItemIndex: 0,
        completedItems: []
      });

      // [PARALLEL] Download all skins concurrently (max 5 at a time)
      const downloadedMods: ModItem[] = [];
      const BATCH_SIZE = 5;
      
      for (let i = 0; i < skins.length; i += BATCH_SIZE) {
        const batch = skins.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i;
        
        const batchPromises = batch.map(async (skin, batchIdx) => {
          const itemIndex = batchStartIndex + batchIdx;
          
          const result = await this.downloadSkin({
            champion_id: skin.championId,
            skin_id: skin.skinId,
            chroma_id: skin.chromaId,
            form_id: skin.formId
          });

          if (result.success && result.path) {
            completedItems.push(itemIndex);
            return {
              name: skin.chromaName 
                ? `${skin.championName} - ${skin.skinName} (${skin.chromaName})`
                : `${skin.championName} - ${skin.skinName}`,
              path: result.path,
              is_custom: false
            } as ModItem;
          }
          console.warn('[MOD-ACTIVATOR] Failed to download:', skin.skinName, result.error);
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(mod => {
          if (mod) downloadedMods.push(mod);
        });

        // Update progress with completed items
        const completed = Math.min(i + BATCH_SIZE, skins.length);
        onProgress?.({
          stage: 'downloading',
          current: completed,
          total: totalItems,
          message: `${completed}/${skins.length}`,
          currentItemIndex: Math.min(i + BATCH_SIZE - 1, skins.length - 1),
          completedItems: [...completedItems]
        });
      }

      // [STAGE-3] Add custom mods (instant - no download needed)
      for (let i = 0; i < customs.length; i++) {
        const custom = customs[i];
        const itemIndex = skins.length + i;
        
        downloadedMods.push({
          name: custom.name,
          path: custom.path,
          is_custom: true
        });
        
        completedItems.push(itemIndex);
        
        onProgress?.({
          stage: 'preparing',
          current: skins.length + i + 1,
          total: totalItems,
          message: `${skins.length + i + 1}/${totalItems}`,
          currentItemIndex: itemIndex,
          completedItems: [...completedItems]
        });
      }

      if (downloadedMods.length === 0) {
        return {
          success: false,
          message: '',
          error: 'No mods to activate',
          vanguard_blocked: false
        };
      }

      // [STAGE-4] Activate mods - backend handles caching
      onProgress?.({
        stage: 'activating',
        current: totalItems - 1,
        total: totalItems,
        message: 'Activating mods...',
        currentItemIndex: totalItems - 1,
        completedItems: [...completedItems]
      });

      const activationResult = await invoke<ActivationResult>('activate_mods', {
        mods: downloadedMods,
        gamePath: this.gamePath
      });

      const elapsed = Date.now() - startTime;
      console.log(`[MOD-ACTIVATOR] Activation completed in ${elapsed}ms`);

      // [COMPLETE] Mark all items as completed
      const allCompleted = Array.from({ length: totalItems }, (_, i) => i);

      if (activationResult.success) {
        this.overlayRunning = true;
        this.lastSelectionHash = currentHash;
        
        onProgress?.({
          stage: 'complete',
          current: totalItems,
          total: totalItems,
          message: `${(elapsed / 1000).toFixed(1)}s`,
          completedItems: allCompleted
        });
      } else {
        this.overlayRunning = false;
        
        // [DLL-FIX] Auto-refresh DLL if Vanguard blocked
        if (activationResult.vanguard_blocked) {
          console.log('[MOD-ACTIVATOR] Vanguard block detected - auto-refreshing DLL...');
          const dllRefreshed = await this.handleVanguardBlock();
          
          if (dllRefreshed) {
            // Notify user that DLL was refreshed and they should retry
            onProgress?.({
              stage: 'error',
              current: 0,
              total: totalItems,
              message: 'DLL refreshed - please retry activation',
              vanguardBlocked: true
            });
          } else {
            onProgress?.({
              stage: 'error',
              current: 0,
              total: totalItems,
              message: activationResult.error || 'Vanguard blocked - DLL refresh failed',
              vanguardBlocked: true
            });
          }
        } else {
          onProgress?.({
            stage: 'error',
            current: 0,
            total: totalItems,
            message: activationResult.error || 'Activation failed',
            vanguardBlocked: false
          });
        }
      }

      return activationResult;

    } catch (error) {
      console.error('[MOD-ACTIVATOR] Activation error:', error);
      this.overlayRunning = false;
      onProgress?.({
        stage: 'error',
        current: 0,
        total: skins.length + customs.length,
        message: String(error),
        vanguardBlocked: false
      });
      return {
        success: false,
        message: '',
        error: String(error),
        vanguard_blocked: false
      };
    } finally {
      this.isActivating = false;
    }
  }

  /**
   * Cleanup overlay files
   */
  async cleanup(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('cleanup_overlay');
      console.log('[MOD-ACTIVATOR] Cleanup result:', result);
      return result;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Cleanup failed:', error);
      return false;
    }
  }

  /**
   * Stop running overlay
   */
  async stopOverlay(): Promise<boolean> {
    try {
      console.log('[MOD-ACTIVATOR] Stopping overlay...');
      const result = await invoke<{ success: boolean; message: string; error?: string }>('stop_overlay');
      
      if (result.success) {
        this.overlayRunning = false;
        console.log('[MOD-ACTIVATOR] Overlay stopped successfully');
      } else {
        console.error('[MOD-ACTIVATOR] Stop failed:', result.error);
      }
      
      return result.success;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Stop overlay error:', error);
      return false;
    }
  }

  /**
   * Check if overlay is currently running
   */
  async checkOverlayStatus(): Promise<boolean> {
    try {
      const running = await invoke<boolean>('is_overlay_running');
      this.overlayRunning = running;
      console.log('[MOD-ACTIVATOR] Overlay status:', running ? 'RUNNING' : 'STOPPED');
      return running;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Status check failed:', error);
      return false;
    }
  }

  /**
   * Get overlay running state (cached)
   */
  isOverlayRunning(): boolean {
    return this.overlayRunning;
  }

  /**
   * Check if activation is in progress
   */
  isActivationInProgress(): boolean {
    return this.isActivating;
  }

  /**
   * Refresh DLL for Vanguard bypass
   * Call this when Vanguard blocks the mod or periodically to stay ahead
   */
  async refreshDll(): Promise<boolean> {
    try {
      console.log('[MOD-ACTIVATOR] Refreshing DLL for Vanguard bypass...');
      const result = await invoke<boolean>('refresh_dll');
      console.log('[MOD-ACTIVATOR] DLL refresh result:', result);
      return result;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] DLL refresh failed:', error);
      return false;
    }
  }

  /**
   * Get DLL fix status
   * Returns current state of the DLL fix system
   */
  async getDllFixStatus(): Promise<DllFixStatus> {
    try {
      const status = await invoke<DllFixStatus>('get_dll_fix_status');
      console.log('[MOD-ACTIVATOR] DLL fix status:', status);
      return status;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Failed to get DLL status:', error);
      return {
        is_applied: false,
        version: null,
        latest_version: null,
        last_check_hours_ago: null,
        dll_exists: false,
        needs_update: false
      };
    }
  }

  /**
   * Auto-refresh DLL if Vanguard blocked
   * Called automatically when activation fails due to Vanguard
   */
  async handleVanguardBlock(): Promise<boolean> {
    console.log('[MOD-ACTIVATOR] Vanguard block detected - attempting DLL refresh...');
    const refreshed = await this.refreshDll();
    
    if (refreshed) {
      console.log('[MOD-ACTIVATOR] DLL refreshed successfully - retry activation');
    } else {
      console.warn('[MOD-ACTIVATOR] DLL refresh failed - manual intervention may be needed');
    }
    
    return refreshed;
  }

  /**
   * Run system diagnostic
   * Returns detailed information about the mod system state
   */
  async runDiagnostic(): Promise<SystemDiagnostic> {
    try {
      console.log('[MOD-ACTIVATOR] Running system diagnostic...');
      const diagnostic = await invoke<SystemDiagnostic>('run_diagnostic');
      console.log('[MOD-ACTIVATOR] Diagnostic results:', diagnostic);
      return diagnostic;
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Diagnostic failed:', error);
      return {
        managers_dir_found: false,
        managers_dir_path: null,
        mod_tools_exists: false,
        dll_exists: false,
        dll_size: 0,
        game_path: null,
        overlay_status: 'error',
        cslol_version: null,
        profile_dir_exists: false,
        profile_file_count: 0,
        installed_mod_count: 0
      };
    }
  }

  /**
   * Update cslol-tools DLL from GitHub
   * Downloads the latest DLL to fix Vanguard detection issues
   */
  async updateCslolTools(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[MOD-ACTIVATOR] Updating cslol-tools from GitHub...');
      const result = await invoke<string>('update_cslol_tools');
      console.log('[MOD-ACTIVATOR] Update result:', result);
      return { success: true, message: result };
    } catch (error) {
      console.error('[MOD-ACTIVATOR] Update failed:', error);
      return { success: false, message: String(error) };
    }
  }
}

// [EXPORT] Singleton instance
export const modActivator = new ModActivatorService();

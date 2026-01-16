/**
 * File: rpc.ts
 * Author: Wildflover
 * Description: Discord Rich Presence service for frontend
 *              - Page-based activity updates
 *              - Champion browsing status
 *              - i18n integration for localized status
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';
import i18n from '../../i18n';

// [CONSTANTS] Storage key for RPC setting
const RPC_STORAGE_KEY = 'wildflover_rpc_enabled';

// [CONSTANTS] RPC Activity keys for i18n lookup
const RPC_ACTIVITY_KEYS = {
  DASHBOARD: {
    stateKey: 'rpc.browsingSkins',
    detailsKey: 'rpc.viewingDashboard',
  },
  HOME: {
    stateKey: 'rpc.exploringChampions',
    detailsKey: 'rpc.browsingCollection',
  },
  CUSTOMS: {
    stateKey: 'rpc.managingCustoms',
    detailsKey: 'rpc.browsingCustomMods',
  },
  FAVORITES: {
    stateKey: 'rpc.managingFavorites',
    detailsKey: 'rpc.organizingFavorites',
  },
  SETTINGS: {
    stateKey: 'rpc.configuringApp',
    detailsKey: 'rpc.customizingSettings',
  },
  MARKETPLACE: {
    stateKey: 'rpc.browsingMarketplace',
    detailsKey: 'rpc.exploringMods',
  },
  SKIN_SELECTOR: {
    stateKey: 'rpc.selectingSkin',
    detailsKey: 'rpc.browsingSkinFor',
  },
} as const;

// [CONSTANTS] RPC Asset configuration
const RPC_ASSETS = {
  largeImage: 'wildflover_splash_login',
  largeText: 'Wildflover - LoL Skin Manager',
  smallImage: 'new_icon',
  smallText: 'Wildflover',
} as const;

// [CONSTANTS] RPC update debounce delay (ms)
const RPC_UPDATE_DELAY = 1000;

// [TYPE] Activity page types
export type RpcPage = keyof typeof RPC_ACTIVITY_KEYS;

// [INTERFACE] RPC result from Rust backend
interface RpcResult {
  success: boolean;
  message: string;
}


// [CLASS] Discord RPC Service
class DiscordRpcService {
  private enabled: boolean = false;
  private currentPage: RpcPage = 'DASHBOARD';
  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingChampionName: string | undefined = undefined;

  constructor() {
    this.loadStoredState();
  }

  // [METHOD] Get localized text for RPC
  private getLocalizedText(key: string, params?: Record<string, string>): string {
    return i18n.t(key, params);
  }

  // [METHOD] Load stored RPC state from localStorage
  // Default: enabled (true) for first-time users
  private loadStoredState(): void {
    try {
      const stored = localStorage.getItem(RPC_STORAGE_KEY);
      // If no stored value (first launch), default to enabled
      this.enabled = stored === null ? true : stored === 'true';
      console.log('[DISCORD-RPC] Loaded state:', this.enabled);
    } catch (error) {
      console.error('[DISCORD-RPC] Failed to load state:', error);
      this.enabled = true; // Default to enabled on error
    }
  }

  // [METHOD] Save RPC state to localStorage
  private saveState(): void {
    try {
      localStorage.setItem(RPC_STORAGE_KEY, String(this.enabled));
    } catch (error) {
      console.error('[DISCORD-RPC] Failed to save state:', error);
    }
  }

  // [METHOD] Enable Discord RPC
  public async enable(): Promise<boolean> {
    try {
      const result = await invoke<RpcResult>('set_rpc_enabled', { enabled: true });
      
      if (result.success) {
        this.enabled = true;
        this.saveState();
        await this.updateActivity(this.currentPage);
        console.log('[DISCORD-RPC] Enabled successfully');
        return true;
      }
      
      console.error('[DISCORD-RPC] Enable failed:', result.message);
      return false;
    } catch (error) {
      console.error('[DISCORD-RPC] Enable error:', error);
      return false;
    }
  }

  // [METHOD] Disable Discord RPC
  public async disable(): Promise<boolean> {
    try {
      const result = await invoke<RpcResult>('set_rpc_enabled', { enabled: false });
      
      if (result.success) {
        this.enabled = false;
        this.saveState();
        console.log('[DISCORD-RPC] Disabled successfully');
        return true;
      }
      
      console.error('[DISCORD-RPC] Disable failed:', result.message);
      return false;
    } catch (error) {
      console.error('[DISCORD-RPC] Disable error:', error);
      return false;
    }
  }

  // [METHOD] Toggle RPC state
  public async toggle(): Promise<boolean> {
    if (this.enabled) {
      return this.disable();
    } else {
      return this.enable();
    }
  }

  // [METHOD] Check if RPC is enabled
  public isEnabled(): boolean {
    return this.enabled;
  }

  // [METHOD] Set current page and update activity with debounce
  public setPage(page: RpcPage, championName?: string): void {
    this.currentPage = page;
    this.pendingChampionName = championName;
    
    if (!this.enabled) return;
    
    // [DEBOUNCE] Cancel previous pending update
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // [DEBOUNCE] Schedule new update
    this.updateTimeout = setTimeout(() => {
      this.updateActivity(this.currentPage, this.pendingChampionName);
      this.updateTimeout = null;
    }, RPC_UPDATE_DELAY);
  }

  // [METHOD] Update Discord activity with i18n support
  private async updateActivity(page: RpcPage, championName?: string): Promise<void> {
    if (!this.enabled) return;

    const keys = RPC_ACTIVITY_KEYS[page];
    let state: string;
    let details: string;

    // [I18N] Get localized strings based on page type
    if (page === 'SKIN_SELECTOR' && championName) {
      state = this.getLocalizedText('rpc.browsingSkinFor', { champion: championName });
      details = this.getLocalizedText('rpc.selectingSkin');
    } else {
      state = this.getLocalizedText(keys.stateKey);
      details = this.getLocalizedText(keys.detailsKey);
    }

    try {
      await invoke<RpcResult>('update_activity', {
        state,
        details,
        largeImage: RPC_ASSETS.largeImage,
        largeText: RPC_ASSETS.largeText,
        smallImage: RPC_ASSETS.smallImage,
        smallText: RPC_ASSETS.smallText,
      });
      
      console.log('[DISCORD-RPC] Activity updated:', state, '-', details);
    } catch (error) {
      console.error('[DISCORD-RPC] Update activity error:', error);
    }
  }

  // [METHOD] Clear activity
  public async clearActivity(): Promise<void> {
    try {
      await invoke<RpcResult>('clear_activity');
      console.log('[DISCORD-RPC] Activity cleared');
    } catch (error) {
      console.error('[DISCORD-RPC] Clear activity error:', error);
    }
  }

  // [METHOD] Initialize RPC on app start
  public async initialize(): Promise<void> {
    if (this.enabled) {
      await this.enable();
    }
    console.log('[DISCORD-RPC] Initialized, enabled:', this.enabled);
  }

  // [METHOD] Refresh activity with current language (call after language change)
  public async refreshActivity(): Promise<void> {
    if (this.enabled) {
      await this.updateActivity(this.currentPage);
    }
  }
}

// [EXPORT] Singleton instance
export const discordRpc = new DiscordRpcService();
export default discordRpc;

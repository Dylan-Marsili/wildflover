/**
 * File: skinManager.ts
 * Author: Wildflover
 * Description: Skin selection and management service with local storage persistence
 * Language: TypeScript
 */

import { SkinChangeEvent } from '../types';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  SELECTED_SKINS: 'wf_lol_selected_skins',
  SELECTED_CHROMAS: 'wf_lol_selected_chromas',
  SELECTED_FORMS: 'wf_lol_selected_forms',
  FAVORITES: 'wf_lol_favorites',
  RECENT_CHAMPIONS: 'wf_lol_recent_champions',
  SKIN_HISTORY: 'wf_lol_skin_history'
} as const;

// [INTERFACE] Chroma selection data structure
interface ChromaSelection {
  chromaId: number;
  chromaName: string;
  skinId: number;
  skinName: string;
  colors: string[];
}

// [INTERFACE] Form selection data structure (tiered skins)
interface FormSelection {
  formId: number;
  formName: string;
  stage: number;
  skinId: number;
  skinName: string;
}

// ============================================================================
// SKIN MANAGER SERVICE
// ============================================================================

class SkinManagerService {
  private static instance: SkinManagerService;
  private selectedSkins: Map<number, number> = new Map(); // championId -> skinId
  private selectedChromas: Map<number, ChromaSelection> = new Map(); // championId -> ChromaSelection
  private selectedForms: Map<number, FormSelection> = new Map(); // championId -> FormSelection
  private favorites: Set<number> = new Set(); // championIds
  private recentChampions: number[] = [];
  private skinHistory: SkinChangeEvent[] = [];
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): SkinManagerService {
    if (!SkinManagerService.instance) {
      SkinManagerService.instance = new SkinManagerService();
    }
    return SkinManagerService.instance;
  }

  // --------------------------------------------------------------------------
  // SKIN SELECTION
  // --------------------------------------------------------------------------

  public selectSkinById(championId: number, skinId: number): void {
    const previousSkinId = this.selectedSkins.get(championId) || null;
    
    this.selectedSkins.set(championId, skinId);
    
    // [CLEANUP] Clear chroma and form when skin changes
    if (previousSkinId !== skinId) {
      this.selectedChromas.delete(championId);
      this.selectedForms.delete(championId);
    }
    
    this.addToRecent(championId);
    
    const event: SkinChangeEvent = {
      championId,
      skinId,
      previousSkinId,
      timestamp: Date.now()
    };
    this.skinHistory.unshift(event);
    
    if (this.skinHistory.length > 50) {
      this.skinHistory = this.skinHistory.slice(0, 50);
    }

    this.saveToStorage();
    this.notifyListeners();
    
    console.log('[SKIN-MANAGER] Skin selected:', { championId, skinId });
  }

  public getSelectedSkin(championId: number): number | null {
    return this.selectedSkins.get(championId) || null;
  }

  public clearSkinSelection(championId: number): void {
    this.selectedSkins.delete(championId);
    this.selectedChromas.delete(championId);
    this.selectedForms.delete(championId);
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Skin selection cleared for champion:', championId);
  }

  public clearAllSelections(): void {
    // [OPTIMIZE] Batch clear - single operation
    this.selectedSkins.clear();
    this.selectedChromas.clear();
    this.selectedForms.clear();
    
    // [OPTIMIZE] Single storage write
    this.saveToStorage();
    
    // [OPTIMIZE] Single notification
    this.notifyListeners();
    
    console.log('[SKIN-MANAGER] All skin selections cleared');
  }

  public getAllSelectedSkins(): Map<number, number> {
    return new Map(this.selectedSkins);
  }

  // --------------------------------------------------------------------------
  // CHROMA SELECTION
  // --------------------------------------------------------------------------

  public selectChroma(
    championId: number, 
    chromaId: number, 
    chromaName: string, 
    skinId: number, 
    skinName: string,
    colors: string[] = []
  ): void {
    this.selectedChromas.set(championId, {
      chromaId,
      chromaName,
      skinId,
      skinName,
      colors
    });
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Chroma selected:', { championId, chromaId, chromaName, colors });
  }

  public clearChromaSelection(championId: number): void {
    this.selectedChromas.delete(championId);
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Chroma selection cleared for champion:', championId);
  }

  public getSelectedChroma(championId: number): ChromaSelection | null {
    return this.selectedChromas.get(championId) || null;
  }

  public getAllSelectedChromas(): Map<number, ChromaSelection> {
    return new Map(this.selectedChromas);
  }

  // --------------------------------------------------------------------------
  // FORM SELECTION (Tiered Skins)
  // --------------------------------------------------------------------------

  public selectForm(
    championId: number,
    formId: number,
    formName: string,
    stage: number,
    skinId: number,
    skinName: string
  ): void {
    this.selectedForms.set(championId, {
      formId,
      formName,
      stage,
      skinId,
      skinName
    });
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Form selected:', { championId, formId, formName, stage });
  }

  public clearFormSelection(championId: number): void {
    this.selectedForms.delete(championId);
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Form selection cleared for champion:', championId);
  }

  public getSelectedForm(championId: number): FormSelection | null {
    return this.selectedForms.get(championId) || null;
  }

  public getAllSelectedForms(): Map<number, FormSelection> {
    return new Map(this.selectedForms);
  }

  // --------------------------------------------------------------------------
  // FAVORITES
  // --------------------------------------------------------------------------

  public toggleFavorite(championId: number): boolean {
    if (this.favorites.has(championId)) {
      this.favorites.delete(championId);
      console.log('[SKIN-MANAGER] Champion removed from favorites:', championId);
    } else {
      this.favorites.add(championId);
      console.log('[SKIN-MANAGER] Champion added to favorites:', championId);
    }
    this.saveToStorage();
    this.notifyListeners();
    return this.favorites.has(championId);
  }

  public addFavorite(championId: number): void {
    this.favorites.add(championId);
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Champion added to favorites:', championId);
  }

  public removeFavorite(championId: number): void {
    this.favorites.delete(championId);
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SKIN-MANAGER] Champion removed from favorites:', championId);
  }

  public isFavorite(championId: number): boolean {
    return this.favorites.has(championId);
  }

  public getFavorites(): number[] {
    return Array.from(this.favorites);
  }

  // --------------------------------------------------------------------------
  // RECENT CHAMPIONS
  // --------------------------------------------------------------------------

  private addToRecent(championId: number): void {
    // Remove if already exists
    this.recentChampions = this.recentChampions.filter(id => id !== championId);
    // Add to front
    this.recentChampions.unshift(championId);
    // Keep only last 10
    if (this.recentChampions.length > 10) {
      this.recentChampions = this.recentChampions.slice(0, 10);
    }
  }

  // --------------------------------------------------------------------------
  // PERSISTENCE
  // --------------------------------------------------------------------------

  private loadFromStorage(): void {
    try {
      // Load selected skins
      const skinsData = localStorage.getItem(STORAGE_KEYS.SELECTED_SKINS);
      if (skinsData) {
        const parsed = JSON.parse(skinsData);
        this.selectedSkins = new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v as number]));
        console.log('[SKIN-MANAGER] Loaded skins:', this.selectedSkins.size);
      }

      // Load selected chromas
      const chromasData = localStorage.getItem(STORAGE_KEYS.SELECTED_CHROMAS);
      if (chromasData) {
        const parsed = JSON.parse(chromasData);
        this.selectedChromas = new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v as ChromaSelection]));
        console.log('[SKIN-MANAGER] Loaded chromas:', this.selectedChromas.size);
      }

      // Load selected forms
      const formsData = localStorage.getItem(STORAGE_KEYS.SELECTED_FORMS);
      if (formsData) {
        const parsed = JSON.parse(formsData);
        this.selectedForms = new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v as FormSelection]));
        console.log('[SKIN-MANAGER] Loaded forms:', this.selectedForms.size);
      }

      // Load favorites
      const favoritesData = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        this.favorites = new Set(JSON.parse(favoritesData));
        console.log('[SKIN-MANAGER] Loaded favorites:', this.favorites.size);
      }

      // Load recent champions
      const recentData = localStorage.getItem(STORAGE_KEYS.RECENT_CHAMPIONS);
      if (recentData) {
        this.recentChampions = JSON.parse(recentData);
      }

      // Load history
      const historyData = localStorage.getItem(STORAGE_KEYS.SKIN_HISTORY);
      if (historyData) {
        this.skinHistory = JSON.parse(historyData);
      }

      console.log('[SKIN-MANAGER] Data loaded from storage successfully');
    } catch (error) {
      console.error('[SKIN-MANAGER-ERROR] Failed to load from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      // Save selected skins
      const skinsObj = Object.fromEntries(this.selectedSkins);
      localStorage.setItem(STORAGE_KEYS.SELECTED_SKINS, JSON.stringify(skinsObj));

      // Save selected chromas
      const chromasObj = Object.fromEntries(this.selectedChromas);
      localStorage.setItem(STORAGE_KEYS.SELECTED_CHROMAS, JSON.stringify(chromasObj));

      // Save selected forms
      const formsObj = Object.fromEntries(this.selectedForms);
      localStorage.setItem(STORAGE_KEYS.SELECTED_FORMS, JSON.stringify(formsObj));

      // Save favorites
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(this.favorites)));

      // Save recent champions
      localStorage.setItem(STORAGE_KEYS.RECENT_CHAMPIONS, JSON.stringify(this.recentChampions));

      // Save history
      localStorage.setItem(STORAGE_KEYS.SKIN_HISTORY, JSON.stringify(this.skinHistory));

      console.log('[SKIN-MANAGER] Data saved to storage');
    } catch (error) {
      console.error('[SKIN-MANAGER-ERROR] Failed to save to storage:', error);
    }
  }

  // --------------------------------------------------------------------------
  // LISTENERS
  // --------------------------------------------------------------------------

  public addChangeListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  public removeChangeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const skinManager = SkinManagerService.getInstance();
export default skinManager;

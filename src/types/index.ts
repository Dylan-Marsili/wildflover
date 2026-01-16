/**
 * File: index.ts
 * Author: Wildflover
 * Description: TypeScript type definitions for Wildflover application
 * Language: TypeScript
 */

// ============================================================================
// SKIN RARITY TYPES
// ============================================================================

export type SkinRarity = 
  | 'kNoRarity'      // Standard skin
  | 'kEpic'          // Epic skin (1350 RP)
  | 'kLegendary'     // Legendary skin (1820 RP)
  | 'kMythic'        // Mythic/Prestige skin
  | 'kUltimate'      // Ultimate skin
  | 'kTranscendent'  // Transcendent skin
  | 'kExalted';      // Exalted skin (T1 Faker etc.)

// ============================================================================
// SKIN FORM TYPES (Tiered Skins - e.g., Risen Legend -> Immortalized Legend)
// ============================================================================

export interface SkinFormData {
  id: number;
  name: string;
  stage: number;
  description: string;
  splashPath: string;
  uncenteredSplashPath: string;
  tilePath: string;
  loadScreenPath: string;
  shortName: string;
}

// ============================================================================
// CHROMA TYPES
// ============================================================================

export interface ChromaData {
  id: number;
  name: string;
  chromaPath: string;
  tilePath: string;
  colors: string[];
}

// ============================================================================
// SKIN TYPES
// ============================================================================

export interface SkinData {
  id: number;
  name: string;
  isBase: boolean;
  rarity: SkinRarity;
  isLegacy: boolean;
  splashPath: string;
  uncenteredSplashPath: string;
  tilePath: string;
  loadScreenPath: string;
  chromas: ChromaData[];
  forms: SkinFormData[];
  description: string | null;
}

// ============================================================================
// CHAMPION TYPES
// ============================================================================

export interface ChampionBasic {
  key: number;
  id: string;
  name: string;
  title: string;
}

export interface ChampionFull {
  id: number;
  key: string;
  name: string;
  title: string;
  skins: SkinData[];
  splashUrl: string;
  iconUrl: string;
}

// ============================================================================
// FILTER & SEARCH TYPES
// ============================================================================

export interface ChampionFilter {
  searchQuery: string;
  role: ChampionRole | 'all';
  sortBy: 'name' | 'recent' | 'favorite';
}

export type ChampionRole = 'assassin' | 'fighter' | 'mage' | 'marksman' | 'support' | 'tank';

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface SkinChangeEvent {
  championId: number;
  skinId: number;
  previousSkinId: number | null;
  timestamp: number;
}

// ============================================================================
// DISCORD TYPES RE-EXPORT
// ============================================================================

export type {
  DiscordUser,
  DiscordGuild,
  DiscordTokenResponse,
  AuthState,
  GuildVerificationResult,
  AuthStatus
} from './discord';

// ============================================================================
// CUSTOMS TYPES RE-EXPORT
// ============================================================================

export type {
  CustomFileExtension,
  CustomModFile,
  CustomModStorage,
  CustomCardProps,
  FileImportResult
} from './customs';

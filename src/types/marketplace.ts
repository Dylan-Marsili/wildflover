/**
 * File: marketplace.ts
 * Author: Wildflover
 * Description: Type definitions for GitHub-based marketplace system
 * Language: TypeScript
 */

// [INTERFACE] User who liked a mod
export interface ModLiker {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  likedAt: string;
}

// [INTERFACE] Single marketplace mod item
export interface MarketplaceMod {
  id: string;
  name: string;
  author: string;
  authorId: string;
  authorAvatar?: string | null;
  description: string;
  title: string;
  tags: string[];
  version: string;
  downloadUrl: string;
  previewUrl?: string;
  fileSize: number;
  downloadCount: number;
  likeCount: number;
  likedBy?: ModLiker[];
  createdAt: string;
  updatedAt: string;
}

// [INTERFACE] Marketplace catalog structure from GitHub
export interface MarketplaceCatalog {
  version: string;
  lastUpdated: string;
  totalMods: number;
  mods: MarketplaceMod[];
}

// [INTERFACE] Upload mod metadata form
export interface UploadModMetadata {
  name: string;
  description: string;
  title: string;
  tags: string[];
  version: string;
}

// [INTERFACE] Download result from backend
export interface MarketplaceDownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

// [INTERFACE] Upload result from backend
export interface MarketplaceUploadResult {
  success: boolean;
  modId?: string;
  commitUrl?: string;
  error?: string;
}

// [INTERFACE] Filter state for marketplace
export interface MarketplaceFilters {
  title: string | null;
  tags: string[];
  author: string | null;
  searchQuery: string;
  sortBy: 'newest' | 'popular' | 'mostDownloaded' | 'name' | 'size' | 'downloaded';
}

// [INTERFACE] Download progress state
export interface DownloadProgress {
  modId: string;
  progress: number;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  error?: string;
}

// [INTERFACE] Upload progress state
export interface UploadProgress {
  stage: 'idle' | 'reading' | 'uploading' | 'committing' | 'complete' | 'error';
  progress: number;
  message: string;
}

// [TYPE] Available title filter options
export type TitleFilterOption = {
  id: string;
  name: string;
  count: number;
};

// [TYPE] Available tag filter options
export type TagFilterOption = {
  tag: string;
  count: number;
};

// [INTERFACE] Download history item for tracking user downloads
export interface DownloadHistoryItem {
  id: string;
  modId: string;
  modName: string;
  modAuthor: string;
  modTitle: string;
  previewUrl: string | null;
  fileSize: number;
  downloadedAt: number;
  status: 'completed' | 'failed';
}

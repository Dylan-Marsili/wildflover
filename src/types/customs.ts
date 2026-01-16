/**
 * File: customs.ts
 * Author: Wildflover
 * Description: TypeScript type definitions for custom mod files (.wad, .wad.client, .zip)
 * Language: TypeScript
 */

// ============================================================================
// CUSTOM MOD FILE TYPES
// ============================================================================

/**
 * Supported custom mod file extensions
 */
export type CustomFileExtension = '.wad' | '.wad.client' | '.zip' | '.fantome';

/**
 * Custom mod file data structure
 */
export interface CustomModFile {
  /** Unique identifier for the custom mod */
  id: string;
  /** Original file name */
  fileName: string;
  /** File extension type */
  extension?: CustomFileExtension;
  /** Full file path on local system */
  filePath: string;
  /** File size in bytes */
  fileSize: number;
  /** Custom display name (user editable) */
  displayName: string;
  /** Custom thumbnail image (base64 or local path) */
  thumbnailPath: string | null;
  /** Whether the mod is currently active */
  isActive: boolean;
  /** Date when the mod was added */
  addedAt: number;
  /** Date when the mod was last modified */
  updatedAt?: number;
  /** Optional description */
  description?: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Source of the mod: local or marketplace */
  source?: 'local' | 'marketplace';
}

/**
 * Custom mod storage data structure
 */
export interface CustomModStorage {
  /** List of all custom mods */
  mods: CustomModFile[];
  /** Storage version for migration */
  version: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Custom mod card display props
 */
export interface CustomCardProps {
  mod: CustomModFile;
  onEdit: (mod: CustomModFile) => void;
  onDelete: (modId: string) => void;
  onToggleActive: (modId: string) => void;
  onImageChange: (modId: string, imageData: string) => void;
}

/**
 * File import result
 */
export interface FileImportResult {
  success: boolean;
  mod?: CustomModFile;
  error?: string;
  duplicateFileName?: string;
}

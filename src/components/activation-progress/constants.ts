/**
 * File: constants.ts
 * Author: Wildflover
 * Description: Constants for activation progress modal - phases, WAD templates, timing
 * Language: TypeScript
 */

// [CONST] Operation phases with realistic timing
export const OPERATION_PHASES = [
  { phase: 'downloading', label: 'Fetching from CDN' },
  { phase: 'extracting', label: 'Extracting WAD' },
  { phase: 'writing', label: 'Writing assets' },
  { phase: 'injecting', label: 'Injecting to client' },
] as const;

// [CONST] Realistic WAD file paths based on actual LoL structure
export const WAD_FILE_TEMPLATES = {
  skin: [
    'DATA/Characters/{champion}/Skins/Skin{id}.wad.client',
    'DATA/Characters/{champion}/Skins/Base.wad.client',
    'DATA/FINAL/Champions/{champion}.wad.client',
  ],
  custom: [
    'DATA/Characters/{name}/Skins/Base.wad.client',
    'DATA/FINAL/Champions/{name}.wad.client',
    'assets.wad.client',
  ]
};

// [CONST] Animation timing constants
export const VISUAL_DELAY_PER_ITEM = 650;
export const PHASE_CYCLE_INTERVAL = 280;

// [CONST] Operation phase labels
export const OPERATION_LABELS: Record<string, string> = {
  waiting: 'Waiting...',
  downloading: 'Downloading',
  extracting: 'Extracting WAD',
  writing: 'Writing assets',
  injecting: 'Injecting',
  done: 'Complete',
  error: 'Failed'
};

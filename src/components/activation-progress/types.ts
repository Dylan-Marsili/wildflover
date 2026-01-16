/**
 * File: types.ts
 * Author: Wildflover
 * Description: Type definitions for activation progress modal components
 * Language: TypeScript
 */

import { ActivationProgress, SelectedSkinForDownload, CustomModForActivation } from '../../services/modActivator';

// [PROPS] Component property definitions
export interface ActivationProgressModalProps {
  isOpen: boolean;
  progress: ActivationProgress | null;
  selectedSkins: SelectedSkinForDownload[];
  customMods: CustomModForActivation[];
  onClose: () => void;
}

// [INTERFACE] Detailed operation state for each item
export interface ItemOperation {
  phase: 'waiting' | 'downloading' | 'extracting' | 'writing' | 'injecting' | 'done' | 'error';
  file?: string;
  progress?: number;
}

// [INTERFACE] Stage info for UI display
export interface StageInfo {
  icon: string;
  color: string;
  label: string;
}

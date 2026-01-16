/**
 * File: types.ts
 * Author: Wildflover
 * Description: Type definitions for SkinSelector component
 * Language: TypeScript
 */

import { ChromaData, SkinFormData } from '../../types';

// [INTERFACE] Chroma preview tooltip position state
export interface ChromaPreviewState {
  visible: boolean;
  chroma: ChromaData | null;
  x: number;
  y: number;
}

// [INTERFACE] Form preview tooltip position state
export interface FormPreviewState {
  visible: boolean;
  form: SkinFormData | null;
  x: number;
  y: number;
}

/**
 * File: useActivationAnimation.ts
 * Author: Wildflover
 * Description: Custom hook for managing activation animation state and sequencing
 * Language: TypeScript
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { ActivationProgress, SelectedSkinForDownload, CustomModForActivation } from '../../services/modActivator';
import { ItemOperation } from './types';
import { OPERATION_PHASES, WAD_FILE_TEMPLATES, VISUAL_DELAY_PER_ITEM, PHASE_CYCLE_INTERVAL } from './constants';

// [HOOK] Custom hook for activation animation management
export function useActivationAnimation(
  isOpen: boolean,
  progress: ActivationProgress | null,
  selectedSkins: SelectedSkinForDownload[],
  customMods: CustomModForActivation[]
) {
  // [STATE] Track detailed operations per item
  const [itemOperations, setItemOperations] = useState<Map<number, ItemOperation>>(new Map());
  
  // [STATE] Visual completed items - delayed from actual completedItems for animation
  const [visualCompletedItems, setVisualCompletedItems] = useState<Set<number>>(new Set());
  
  // [STATE] Items currently showing processing animation
  const [animatingItems, setAnimatingItems] = useState<Set<number>>(new Set());
  
  // [REF] Track processed items to avoid re-animating
  const processedItemsRef = useRef<Set<number>>(new Set());

  // [STATE] Track if animation chain has started
  const [animationStarted, setAnimationStarted] = useState(false);
  
  // [STATE] Track if all items finished animating
  const [allItemsAnimated, setAllItemsAnimated] = useState(false);

  // [EFFECT] Reset state when modal opens with new activation
  useEffect(() => {
    if (isOpen) {
      setItemOperations(new Map());
      setVisualCompletedItems(new Set());
      setAnimatingItems(new Set());
      setAnimationStarted(false);
      setAllItemsAnimated(false);
      processedItemsRef.current = new Set();
    }
  }, [isOpen, selectedSkins.length, customMods.length]);


  // [EFFECT] Sequential animation - runs independently until ALL items complete
  useEffect(() => {
    if (!isOpen || !progress) return;
    if (animationStarted) return;
    
    const totalItems = selectedSkins.length + customMods.length;
    if (totalItems === 0) return;
    
    const isActiveStage = progress.stage === 'downloading' || progress.stage === 'preparing' || 
                          progress.stage === 'activating' || progress.stage === 'complete';
    if (!isActiveStage) return;
    
    setAnimationStarted(true);
    console.log('[ACTIVATION-MODAL] Starting sequential animation for', totalItems, 'items');
    
    const intervals: NodeJS.Timeout[] = [];
    
    const processItem = (itemIdx: number) => {
      if (itemIdx >= totalItems) {
        console.log('[ACTIVATION-MODAL] All items animated');
        setAllItemsAnimated(true);
        return;
      }
      
      processedItemsRef.current.add(itemIdx);
      
      const isCustom = itemIdx >= selectedSkins.length;
      const arrayIdx = isCustom ? itemIdx - selectedSkins.length : itemIdx;
      const item = isCustom ? customMods[arrayIdx] : selectedSkins[arrayIdx];
      
      if (!item) {
        setTimeout(() => processItem(itemIdx + 1), 50);
        return;
      }
      
      const championName = isCustom 
        ? (item as CustomModForActivation).name.split(' ')[0]
        : (item as SelectedSkinForDownload).championName;
      const skinId = isCustom 
        ? '00' 
        : String((item as SelectedSkinForDownload).skinId).padStart(2, '0');
      
      const wadTemplates = isCustom ? WAD_FILE_TEMPLATES.custom : WAD_FILE_TEMPLATES.skin;
      
      setAnimatingItems(prev => new Set(prev).add(itemIdx));
      
      let phaseIdx = 0;
      let wadIdx = 0;
      
      const cyclePhase = () => {
        const phase = OPERATION_PHASES[phaseIdx % OPERATION_PHASES.length];
        const wadTemplate = wadTemplates[wadIdx % wadTemplates.length];
        const wadFile = wadTemplate
          .replace('{champion}', championName)
          .replace('{name}', championName)
          .replace('{id}', skinId);
        
        setItemOperations(prev => {
          const newMap = new Map(prev);
          newMap.set(itemIdx, {
            phase: phase.phase as ItemOperation['phase'],
            file: wadFile,
            progress: Math.floor(Math.random() * 30) + 70
          });
          return newMap;
        });
        
        phaseIdx++;
        if (phaseIdx % 2 === 0) wadIdx++;
      };
      
      cyclePhase();
      const intervalId = setInterval(cyclePhase, PHASE_CYCLE_INTERVAL);
      intervals.push(intervalId);
      
      setTimeout(() => {
        clearInterval(intervalId);
        setAnimatingItems(prev => {
          const next = new Set(prev);
          next.delete(itemIdx);
          return next;
        });
        setVisualCompletedItems(prev => new Set(prev).add(itemIdx));
        processItem(itemIdx + 1);
      }, VISUAL_DELAY_PER_ITEM);
    };
    
    processItem(0);
    
    return () => {
      intervals.forEach(id => clearInterval(id));
    };
  }, [isOpen, progress?.stage, animationStarted, selectedSkins, customMods]);

  // [HELPER] Get item status using visual state
  const getItemStatus = (index: number): 'done' | 'processing' | 'pending' | 'error' => {
    if (progress?.stage === 'error') return 'error';
    if (visualCompletedItems.has(index)) return 'done';
    if (animatingItems.has(index)) return 'processing';
    return 'pending';
  };

  // [HELPER] Get operation info for item
  const getItemOperation = (index: number): ItemOperation | undefined => {
    return itemOperations.get(index);
  };

  // [COMPUTED] Sort items - processing first, then pending, then done
  const sortedSkinIndices = useMemo(() => {
    const indices = selectedSkins.map((_, idx) => idx);
    return indices.sort((a, b) => {
      const statusA = getItemStatus(a);
      const statusB = getItemStatus(b);
      const order = { processing: 0, pending: 1, done: 2, error: 3 };
      return order[statusA] - order[statusB];
    });
  }, [selectedSkins, visualCompletedItems, animatingItems, progress?.stage]);

  const sortedCustomIndices = useMemo(() => {
    const indices = customMods.map((_, idx) => idx);
    return indices.sort((a, b) => {
      const statusA = getItemStatus(selectedSkins.length + a);
      const statusB = getItemStatus(selectedSkins.length + b);
      const order = { processing: 0, pending: 1, done: 2, error: 3 };
      return order[statusA] - order[statusB];
    });
  }, [customMods, selectedSkins.length, visualCompletedItems, animatingItems, progress?.stage]);

  return {
    itemOperations,
    visualCompletedItems,
    animatingItems,
    allItemsAnimated,
    getItemStatus,
    getItemOperation,
    sortedSkinIndices,
    sortedCustomIndices
  };
}

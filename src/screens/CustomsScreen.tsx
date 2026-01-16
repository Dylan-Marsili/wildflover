/**
 * File: CustomsScreen.tsx
 * Author: Wildflover
 * Description: Custom mods management screen for .wad, .wad.client, .zip and .fantome files
 * Language: TypeScript/React
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import CustomCard from '../components/CustomCard';
import FantomeImportModal, { type FantomeFileInfo } from '../components/customs/FantomeImportModal';
import { customsStorage } from '../services/customsStorage';
import type { CustomModFile } from '../types/customs';
import './CustomsScreen.css';

// [INTERFACE] File selection result from Rust backend
interface FileSelectionResult {
  success: boolean;
  files: Array<{
    name: string;
    path: string;
    size: number;
  }>;
}

// [INTERFACE] File info result from Rust backend
interface FileInfoResult {
  name: string;
  path: string;
  size: number;
}

// [INTERFACE] Component props
interface CustomsScreenProps {
  isLocked?: boolean;  // When overlay is active, disable all actions
}

// [COMPONENT] Customs management screen
const CustomsScreen = ({ isLocked = false }: CustomsScreenProps) => {
  const { t } = useTranslation();
  const [mods, setMods] = useState<CustomModFile[]>(() => customsStorage.getAllMods());
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // [STATE] Fantome import modal
  const [fantomeImportFile, setFantomeImportFile] = useState<FantomeFileInfo | null>(null);
  const [isFantomeModalOpen, setIsFantomeModalOpen] = useState(false);
  const pendingFantomePathRef = useRef<string | null>(null);
  
  // [STATE] Unsupported file warning
  const [unsupportedWarning, setUnsupportedWarning] = useState<string | null>(null);

  // [EFFECT] Listen to customsStorage changes for sync
  useEffect(() => {
    const handleStorageChange = () => {
      setMods(customsStorage.getAllMods());
    };
    
    customsStorage.addChangeListener(handleStorageChange);
    return () => customsStorage.removeChangeListener(handleStorageChange);
  }, []);

  // [EFFECT] Tauri native drag-drop event listener
  useEffect(() => {
    if (isLocked) return;

    const webview = getCurrentWebviewWindow();
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      try {
        unlisten = await webview.onDragDropEvent(async (event) => {
          if (event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'leave' || event.payload.type === 'cancel') {
            setIsDragging(false);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            const paths = event.payload.paths;
            
            if (!paths || paths.length === 0) return;

            console.log('[CUSTOMS-SCREEN] Tauri drop event received:', paths);

            for (const filePath of paths) {
              const fileName = filePath.split(/[/\\]/).pop() || '';
              
              if (!customsStorage.isSupported(fileName)) {
                console.warn('[CUSTOMS-SCREEN] Unsupported file:', fileName);
                // [WARNING] Show unsupported file warning
                setUnsupportedWarning(fileName);
                setTimeout(() => setUnsupportedWarning(null), 4000);
                continue;
              }

              // [CHECK] If .fantome file, show confirmation modal
              if (fileName.toLowerCase().endsWith('.fantome')) {
                try {
                  // [INVOKE] Get file info from Rust backend
                  const fileInfo = await invoke<FileInfoResult>('get_file_info', { path: filePath });
                  pendingFantomePathRef.current = filePath;
                  setFantomeImportFile({
                    name: fileInfo.name,
                    path: fileInfo.path,
                    size: fileInfo.size
                  });
                  setIsFantomeModalOpen(true);
                  console.log('[CUSTOMS-SCREEN] Fantome file detected, showing import modal:', fileName);
                } catch (err) {
                  console.error('[CUSTOMS-SCREEN] Failed to get file info:', err);
                  // [FALLBACK] Use basic info if backend call fails
                  pendingFantomePathRef.current = filePath;
                  setFantomeImportFile({
                    name: fileName,
                    path: filePath,
                    size: 0
                  });
                  setIsFantomeModalOpen(true);
                }
                return;
              }

              // [ADD] Add other supported files directly
              try {
                const fileInfo = await invoke<FileInfoResult>('get_file_info', { path: filePath });
                const result = customsStorage.addMod(fileInfo.name, fileInfo.path, fileInfo.size);
                if (!result.success) {
                  if (result.error === 'DUPLICATE_FILE' || result.error === 'DUPLICATE_NAME') {
                    setDuplicateWarning(result.duplicateFileName || fileName);
                    setTimeout(() => setDuplicateWarning(null), 4000);
                  }
                }
              } catch (err) {
                console.error('[CUSTOMS-SCREEN] Failed to add file:', err);
              }
            }
          }
        });
        console.log('[CUSTOMS-SCREEN] Tauri drag-drop listener registered');
      } catch (error) {
        console.error('[CUSTOMS-SCREEN] Failed to setup drag-drop listener:', error);
      }
    };

    setupDragDrop();

    return () => {
      if (unlisten) {
        unlisten();
        console.log('[CUSTOMS-SCREEN] Tauri drag-drop listener removed');
      }
    };
  }, [isLocked]);

  // [HANDLER] Open file picker dialog via Rust backend
  const handleAddFiles = useCallback(async () => {
    // [LOCK] Prevent adding files when overlay is active
    if (isLocked) {
      console.log('[CUSTOMS-SCREEN] Action locked - overlay active');
      return;
    }
    
    try {
      const result = await invoke<FileSelectionResult>('select_custom_files');

      if (!result.success || !result.files.length) return;

      const duplicates: string[] = [];

      for (const file of result.files) {
        if (!customsStorage.isSupported(file.name)) {
          console.warn('[CUSTOMS-SCREEN] Unsupported file:', file.name);
          continue;
        }

        const addResult = customsStorage.addMod(file.name, file.path, file.size);
        if (!addResult.success) {
          if (addResult.error === 'DUPLICATE_FILE' || addResult.error === 'DUPLICATE_NAME') {
            duplicates.push(addResult.duplicateFileName || file.name);
          } else {
            console.warn('[CUSTOMS-SCREEN] Failed to add mod:', file.name);
          }
        }
      }

      // [WARNING] Show duplicate warning if any
      if (duplicates.length > 0) {
        setDuplicateWarning(duplicates.join(', '));
        setTimeout(() => setDuplicateWarning(null), 4000);
      }
    } catch (error) {
      console.error('[CUSTOMS-SCREEN] File picker error:', error);
    }
  }, [isLocked]);

  // [HANDLER] Delete mod - disabled when overlay active, also clears cache
  const handleDelete = useCallback(async (modId: string) => {
    if (isLocked) return;
    await customsStorage.deleteMod(modId);
  }, [isLocked]);

  // [HANDLER] Toggle mod active state - disabled when overlay active
  const handleToggleActive = useCallback((modId: string) => {
    if (isLocked) return;
    customsStorage.toggleActive(modId);
  }, [isLocked]);

  // [HANDLER] Update mod thumbnail - disabled when overlay active
  const handleImageChange = useCallback((modId: string, imageData: string) => {
    if (isLocked) return;
    customsStorage.updateThumbnail(modId, imageData);
  }, [isLocked]);

  // [HANDLER] Update mod display name - disabled when overlay active
  const handleNameChange = useCallback((modId: string, name: string) => {
    if (isLocked) return;
    customsStorage.updateDisplayName(modId, name);
  }, [isLocked]);

  // [HANDLER] Confirm fantome import
  const handleFantomeImportConfirm = useCallback(async () => {
    const filePath = pendingFantomePathRef.current;
    if (!filePath || !fantomeImportFile) return;

    const result = customsStorage.addMod(fantomeImportFile.name, filePath, fantomeImportFile.size);
    if (!result.success) {
      if (result.error === 'DUPLICATE_FILE' || result.error === 'DUPLICATE_NAME') {
        setDuplicateWarning(result.duplicateFileName || fantomeImportFile.name);
        setTimeout(() => setDuplicateWarning(null), 4000);
      } else {
        console.warn('[CUSTOMS-SCREEN] Failed to add fantome mod:', fantomeImportFile.name);
      }
    } else {
      console.log('[CUSTOMS-SCREEN] Fantome mod imported successfully:', fantomeImportFile.name);
    }

    // [CLEANUP] Reset modal state
    setIsFantomeModalOpen(false);
    setFantomeImportFile(null);
    pendingFantomePathRef.current = null;
  }, [fantomeImportFile]);

  // [HANDLER] Cancel fantome import
  const handleFantomeImportCancel = useCallback(() => {
    console.log('[CUSTOMS-SCREEN] Fantome import cancelled');
    setIsFantomeModalOpen(false);
    setFantomeImportFile(null);
    pendingFantomePathRef.current = null;
  }, []);

  // [COMPUTED] Filtered mods
  const filteredMods = searchQuery
    ? mods.filter(m => 
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mods;

  // [COMPUTED] Stats
  const totalMods = mods.length;

  return (
    <div 
      className="customs-screen"
      ref={dropZoneRef}
    >
      {/* [HEADER] Screen header */}
      <div className="customs-header">
        <div className="customs-header-left">
          <div className="customs-title-wrapper">
            <div className="customs-title-row">
              <h1 className="customs-title">{t('customs.title')}</h1>
              <span className="customs-badge">{totalMods} {t('customs.subtitle')}</span>
            </div>
            <span className="customs-subtitle">{t('customs.pageDescription', 'Manage your custom mod files')}</span>
          </div>
        </div>

        <div className="customs-header-right">
          {/* [SEARCH] Search input */}
          <div className="customs-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder={t('customs.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* [ADD] Add button */}
          <button className="customs-add-btn" onClick={handleAddFiles}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>{t('customs.addFiles')}</span>
          </button>
        </div>
      </div>

      {/* [CONTENT] Main content area */}
      <div className="customs-content">
        {filteredMods.length > 0 ? (
          <div className="customs-grid">
            {filteredMods.map(mod => (
              <CustomCard
                key={mod.id}
                mod={mod}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onImageChange={handleImageChange}
                onNameChange={handleNameChange}
                isLocked={isLocked}
              />
            ))}
          </div>
        ) : (
          <div className="customs-empty">
            <div className="customs-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 className="customs-empty-title">{t('customs.emptyTitle')}</h3>
            <p className="customs-empty-desc">{t('customs.emptyDesc')}</p>
            <button className="customs-empty-btn" onClick={handleAddFiles}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span>{t('customs.addFirstMod')}</span>
            </button>
          </div>
        )}
      </div>

      {/* [DROPZONE] Drag and drop overlay */}
      {isDragging && (
        <div className="customs-dropzone">
          <div className="customs-dropzone-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>{t('customs.dropHere')}</span>
            <p>{t('customs.supportedFormats')}</p>
          </div>
        </div>
      )}

      {/* [TOAST] Duplicate file warning */}
      {duplicateWarning && (
        <div className="customs-toast">
          <div className="customs-toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="customs-toast-content">
            <span className="customs-toast-title">{t('customs.duplicateTitle')}</span>
            <span className="customs-toast-message">{duplicateWarning}</span>
          </div>
        </div>
      )}

      {/* [TOAST] Unsupported file warning */}
      {unsupportedWarning && (
        <div className="customs-toast customs-toast-error">
          <div className="customs-toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="customs-toast-content">
            <span className="customs-toast-title">{t('customs.unsupportedTitle')}</span>
            <span className="customs-toast-message">{unsupportedWarning}</span>
          </div>
        </div>
      )}

      {/* [MODAL] Fantome import confirmation */}
      <FantomeImportModal
        file={fantomeImportFile}
        isOpen={isFantomeModalOpen}
        onConfirm={handleFantomeImportConfirm}
        onCancel={handleFantomeImportCancel}
      />
    </div>
  );
};

export default CustomsScreen;

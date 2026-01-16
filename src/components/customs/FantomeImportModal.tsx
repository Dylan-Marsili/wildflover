/**
 * File: FantomeImportModal.tsx
 * Author: Wildflover
 * Description: Professional confirmation modal for .fantome file drag & drop import
 * Language: TypeScript/React
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './FantomeImportModal.css';

// [INTERFACE] File info for import confirmation
export interface FantomeFileInfo {
  name: string;
  path: string;
  size: number;
}

// [INTERFACE] Component props
interface FantomeImportModalProps {
  file: FantomeFileInfo | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// [UTILITY] Format file size for display
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};

// [COMPONENT] Fantome import confirmation modal
const FantomeImportModal = ({ file, isOpen, onConfirm, onCancel }: FantomeImportModalProps) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // [EFFECT] Handle escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  // [HANDLER] Backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  if (!isOpen || !file) return null;

  // [COMPUTED] Extract display name from file
  const displayName = file.name.replace(/\.fantome$/i, '');

  return (
    <div className="fantome-import-backdrop" onClick={handleBackdropClick}>
      <div className="fantome-import-modal" ref={modalRef}>
        {/* [HEADER] Modal header with icon */}
        <div className="fantome-import-header">
          <div className="fantome-import-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M12 18v-6"/>
              <path d="M9 15l3-3 3 3"/>
            </svg>
          </div>
          <div className="fantome-import-title-wrapper">
            <h2 className="fantome-import-title">{t('customs.importTitle', 'Import Mod File')}</h2>
            <span className="fantome-import-subtitle">{t('customs.importSubtitle', 'Add to custom mods collection')}</span>
          </div>
        </div>

        {/* [CONTENT] File information */}
        <div className="fantome-import-content">
          <div className="fantome-import-file-card">
            <div className="fantome-import-file-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span className="fantome-import-file-ext">.fantome</span>
            </div>
            <div className="fantome-import-file-info">
              <span className="fantome-import-file-name" title={file.name}>{displayName}</span>
              <div className="fantome-import-file-meta">
                <span className="fantome-import-file-size">{formatFileSize(file.size)}</span>
                <span className="fantome-import-file-type">Fantome Mod</span>
              </div>
            </div>
          </div>

          <p className="fantome-import-message">
            {t('customs.importMessage', 'Do you want to import this file to your custom mods?')}
          </p>
        </div>

        {/* [FOOTER] Action buttons */}
        <div className="fantome-import-footer">
          <button className="fantome-import-btn fantome-import-btn-cancel" onClick={onCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>{t('common.cancel', 'Cancel')}</span>
          </button>
          <button className="fantome-import-btn fantome-import-btn-confirm" onClick={onConfirm}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{t('customs.importConfirm', 'Import')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FantomeImportModal;

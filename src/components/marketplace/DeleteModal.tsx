/**
 * File: DeleteModal.tsx
 * Author: Wildflover
 * Description: Professional delete confirmation modal with sharp modern design
 * Language: TypeScript/React
 */

import React, { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplaceMod } from '../../types/marketplace';
import './DeleteModal.css';

// [PROPS] Component properties
interface DeleteModalProps {
  isOpen: boolean;
  mod: MarketplaceMod | null;
  onConfirm: (mod: MarketplaceMod) => Promise<void>;
  onCancel: () => void;
}

// [COMPONENT] Delete confirmation modal
const DeleteModal = memo(({ isOpen, mod, onConfirm, onCancel }: DeleteModalProps) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [EFFECT] Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setIsDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  // [HANDLER] Confirm delete
  const handleConfirm = useCallback(async () => {
    if (!mod || isDeleting) return;
    
    setIsDeleting(true);
    setError(null);
    
    try {
      await onConfirm(mod);
      setIsDeleting(false);
    } catch (err) {
      setError(String(err));
      setIsDeleting(false);
    }
  }, [mod, isDeleting, onConfirm]);

  // [HANDLER] Cancel and close
  const handleCancel = useCallback(() => {
    if (isDeleting) return;
    setError(null);
    onCancel();
  }, [isDeleting, onCancel]);

  if (!isOpen || !mod) return null;

  return (
    <div className="delete-modal-overlay" onClick={handleCancel}>
      <div className="delete-modal" onClick={e => e.stopPropagation()}>
        {/* [HEADER] Warning section */}
        <div className="delete-modal-header">
          <div className="delete-header-left">
            <div className="delete-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div className="delete-header-text">
              <h3>{t('marketplace.deleteTitle', 'Delete Mod')}</h3>
              <span className="delete-subtitle">{t('marketplace.deleteSubtitle', 'Permanent removal')}</span>
            </div>
          </div>
          <button className="delete-modal-close" onClick={handleCancel} disabled={isDeleting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* [CONTENT] Warning and mod info */}
        <div className="delete-modal-content">
          <div className="delete-warning-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{t('marketplace.deleteWarning', 'This action cannot be undone')}</span>
          </div>

          <div className="delete-mod-card">
            <div className="delete-mod-info">
              <span className="delete-mod-name">{mod.name}</span>
              <span className="delete-mod-author">by {mod.author}</span>
            </div>
            <div className="delete-mod-id">{mod.id}</div>
          </div>

          <p className="delete-note">
            {t('marketplace.deleteNote', 'This will permanently remove the mod from GitHub repository including all associated files and data.')}
          </p>

          {error && (
            <div className="delete-error-bar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* [FOOTER] Actions */}
        <div className="delete-modal-footer">
          <button className="delete-btn cancel" onClick={handleCancel} disabled={isDeleting}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button className="delete-btn confirm" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <span className="delete-spinner" />
                {t('marketplace.deleting', 'Deleting...')}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('marketplace.deleteConfirm', 'Delete Permanently')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default DeleteModal;

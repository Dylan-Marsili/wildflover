/**
 * File: EditModal.tsx
 * Author: Wildflover
 * Description: Professional edit modal with modern design matching UploadModal
 * Language: TypeScript/React
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplaceMod } from '../../types/marketplace';
import './EditModal.css';

// [PROPS] Component properties
interface EditModalProps {
  isOpen: boolean;
  mod: MarketplaceMod | null;
  onClose: () => void;
  onSave: (modId: string, updates: ModUpdateData) => Promise<void>;
}

// [TYPE] Update data structure
export interface ModUpdateData {
  name: string;
  title: string;
  description: string;
  tags: string[];
}

// [COMPONENT] Edit modal for mod metadata
export default function EditModal({ isOpen, mod, onClose, onSave }: EditModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  
  // [STATE] Form data
  const [name, setName] = useState(mod?.name || '');
  const [title, setTitle] = useState(mod?.title || '');
  const [description, setDescription] = useState(mod?.description || '');
  const [tags, setTags] = useState<string[]>(mod?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [EFFECT] Reset form when mod changes
  React.useEffect(() => {
    if (mod) {
      setName(mod.name);
      setTitle(mod.title);
      setDescription(mod.description);
      setTags(mod.tags || []);
      setError(null);
      setTagInput('');
    }
  }, [mod]);

  // [HANDLER] Add new tag
  const handleAddTag = useCallback(() => {
    const input = tagInput.trim();
    if (!input) return;
    const newTags = input.split(/[\s,]+/).map(tag => tag.trim().toLowerCase()).filter(tag => tag && !tags.includes(tag));
    const tagsToAdd = newTags.slice(0, 5 - tags.length);
    if (tagsToAdd.length > 0) setTags(prev => [...prev, ...tagsToAdd]);
    setTagInput('');
  }, [tagInput, tags]);

  // [HANDLER] Remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  // [HANDLER] Key press for tag input
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  // [HANDLER] Save changes
  const handleSave = useCallback(async () => {
    if (!mod) return;
    
    if (!name.trim()) {
      setError(t('marketplace.editNameRequired', 'Mod name is required'));
      return;
    }
    if (!title.trim()) {
      setError(t('marketplace.editTitleRequired', 'Title is required'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(mod.id, {
        name: name.trim(),
        title: title.trim(),
        description: description.trim(),
        tags
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [mod, name, title, description, tags, onSave, onClose, t]);

  // [HANDLER] Close modal
  const handleClose = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  if (!isOpen || !mod) return null;

  return (
    <div className="edit-modal-backdrop" onClick={e => e.stopPropagation()}>
      <div className="edit-modal" ref={modalRef}>
        {/* [HEADER] Modal header */}
        <div className="edit-modal-header">
          <div className="edit-header-title">
            <h2>
              <svg className="edit-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {t('marketplace.editTitle', 'Edit Mod')}
            </h2>
            <span className="edit-modal-subtitle">{mod.id}</span>
          </div>
          <div className="edit-header-actions">
            <button className="edit-modal-help">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
              <div className="edit-help-tooltip" onClick={e => e.stopPropagation()}>
                <div className="edit-help-title">{t('marketplace.editHelpTitle', 'How to Use?')}</div>
                <div className="edit-help-content">{t('marketplace.editHelpContent', 'Edit your mod information from this panel.')}</div>
                <div className="edit-help-section">
                  <div className="edit-help-section-title">{t('marketplace.editHelpFieldsTitle', 'Fields')}</div>
                  <div className="edit-help-item">
                    <span className="edit-help-label">{t('marketplace.editHelpName', 'Mod Name')}</span>
                    <span className="edit-help-desc">{t('marketplace.editHelpNameDesc', 'Display name in marketplace')}</span>
                  </div>
                  <div className="edit-help-item">
                    <span className="edit-help-label">{t('marketplace.editHelpTitleField', 'Title')}</span>
                    <span className="edit-help-desc">{t('marketplace.editHelpTitleDesc', 'Champion or category')}</span>
                  </div>
                  <div className="edit-help-item">
                    <span className="edit-help-label">{t('marketplace.editHelpDescField', 'Description')}</span>
                    <span className="edit-help-desc">{t('marketplace.editHelpDescInfo', 'Brief info about mod')}</span>
                  </div>
                  <div className="edit-help-item">
                    <span className="edit-help-label">{t('marketplace.editHelpTagsField', 'Tags')}</span>
                    <span className="edit-help-desc">{t('marketplace.editHelpTagsDesc', 'Keywords for search')}</span>
                  </div>
                </div>
              </div>
            </button>
            <button className="edit-modal-close" onClick={handleClose} disabled={saving}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* [CONTENT] Form content */}
        <div className="edit-modal-content">
          <div className="edit-form-section">
            {/* [NAME] Mod name */}
            <div className="edit-field">
              <div className="edit-field-header">
                <label>{t('marketplace.editName', 'Mod Name')} *</label>
                <span className="edit-field-hint">{t('marketplace.editNameHint', 'Display name in marketplace')}</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('marketplace.editNamePlaceholder', 'e.g., Ahri Spirit Blossom')}
                disabled={saving}
                maxLength={100}
              />
            </div>

            {/* [TITLE] Title/Category */}
            <div className="edit-field">
              <div className="edit-field-header">
                <label>{t('marketplace.editTitleLabel', 'Title / Category')} *</label>
                <span className="edit-field-hint">{t('marketplace.editTitleHint', 'Champion or category')}</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('marketplace.editTitlePlaceholder', 'e.g., Ahri, HUD, VFX')}
                disabled={saving}
                maxLength={50}
              />
            </div>

            {/* [DESCRIPTION] Description */}
            <div className="edit-field">
              <div className="edit-field-header">
                <label>{t('marketplace.editDescription', 'Description')}</label>
                <span className="edit-field-hint">{t('marketplace.editDescHint', 'Brief info about mod')}</span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('marketplace.editDescPlaceholder', 'Describe your mod...')}
                disabled={saving}
                maxLength={500}
              />
            </div>

            {/* [TAGS] Tags */}
            <div className="edit-field">
              <div className="edit-field-header">
                <label>{t('marketplace.editTags', 'Tags')} (max 5)</label>
                <span className="edit-field-hint">{t('marketplace.editTagsHint', 'Keywords for search')}</span>
              </div>
              <div className="edit-tags-input">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={t('marketplace.editTagPlaceholder', 'Add tag...')}
                  disabled={saving}
                  maxLength={20}
                />
                <button onClick={handleAddTag} disabled={tags.length >= 5 || saving}>+</button>
              </div>
              {tags.length > 0 && (
                <div className="edit-tags-list">
                  {tags.map(tag => (
                    <span key={tag} className="edit-tag">
                      <span>{tag}</span>
                      <button onClick={() => handleRemoveTag(tag)} disabled={saving}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* [ERROR] Error notification */}
        {error && (
          <div className="edit-error-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* [FOOTER] Action buttons */}
        <div className="edit-modal-footer">
          <button className="edit-btn cancel" onClick={handleClose} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button className="edit-btn submit" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="edit-spinner" />
                {t('marketplace.editSaving', 'Saving...')}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {t('marketplace.editSave', 'Save Changes')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

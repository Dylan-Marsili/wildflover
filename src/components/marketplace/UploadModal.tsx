/**
 * File: UploadModal.tsx
 * Author: Wildflover
 * Description: Professional upload modal with preview section
 * Language: TypeScript/React
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { marketplaceService } from '../../services/marketplaceService';
import type { UploadModMetadata, UploadProgress } from '../../types/marketplace';
import './UploadModal.css';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  githubToken: string;
  onUploadSuccess: () => void;
}

interface FileSelectionResult {
  success: boolean;
  files: Array<{ name: string; path: string; size: number }>;
}

interface PreviewSelectionResult {
  success: boolean;
  files: Array<{ name: string; path: string; size: number }>;
  base64?: string;
}

export default function UploadModal({
  isOpen, onClose, authorId, authorName, authorAvatar, githubToken, onUploadSuccess
}: UploadModalProps) {
  const { t } = useTranslation();
  
  const [modFile, setModFile] = useState<{ name: string; path: string; size: number } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; path: string; base64: string } | null>(null);
  const [metadata, setMetadata] = useState<UploadModMetadata>({
    name: '', description: '', title: '', tags: [], version: '1.0.0'
  });
  const [tagInput, setTagInput] = useState('');
  const [progress, setProgress] = useState<UploadProgress>({ stage: 'idle', progress: 0, message: '' });
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSelectModFile = useCallback(async () => {
    try {
      const result = await invoke<FileSelectionResult>('select_custom_files');
      if (result.success && result.files.length > 0) {
        const file = result.files[0];
        setModFile(file);
        if (!metadata.name) {
          const nameWithoutExt = file.name.replace(/\.(fantome|zip)$/i, '');
          setMetadata(prev => ({ ...prev, name: nameWithoutExt }));
        }
      }
    } catch (error) {
      console.error('[UPLOAD-MODAL] File selection failed:', error);
    }
  }, [metadata.name]);

  const handleSelectPreview = useCallback(async () => {
    try {
      const result = await invoke<PreviewSelectionResult>('select_preview_image_with_data');
      if (result.success && result.files.length > 0 && result.base64) {
        const file = result.files[0];
        setPreviewFile({ name: file.name, path: file.path, base64: `data:image/jpeg;base64,${result.base64}` });
      }
    } catch (error) {
      console.error('[UPLOAD-MODAL] Preview selection failed:', error);
    }
  }, []);

  const handleAddTag = useCallback(() => {
    const input = tagInput.trim();
    if (!input) return;
    const newTags = input.split(/[\s,]+/).map(tag => tag.trim().toLowerCase()).filter(tag => tag && !metadata.tags.includes(tag));
    const tagsToAdd = newTags.slice(0, 5 - metadata.tags.length);
    if (tagsToAdd.length > 0) setMetadata(prev => ({ ...prev, tags: [...prev.tags, ...tagsToAdd] }));
    setTagInput('');
  }, [tagInput, metadata.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setMetadata(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  }, []);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  }, [handleAddTag]);

  const handleSubmit = useCallback(async () => {
    if (!modFile || !metadata.name || !metadata.title) return;
    setProgress({ stage: 'reading', progress: 10, message: t('marketplace.uploadReading', 'Reading...') });
    try {
      setProgress({ stage: 'uploading', progress: 30, message: t('marketplace.uploadUploading', 'Uploading...') });
      const result = await marketplaceService.uploadMod(
        metadata, modFile.path, previewFile?.path || null, 
        authorId, authorName, authorAvatar, githubToken
      );
      if (result.success) {
        setProgress({ stage: 'complete', progress: 100, message: t('marketplace.uploadSuccess', 'Success!') });
        setTimeout(() => { onUploadSuccess(); handleReset(); onClose(); }, 1500);
      } else {
        setProgress({ stage: 'error', progress: 0, message: result.error || t('marketplace.uploadFailed', 'Failed') });
      }
    } catch (error) {
      setProgress({ stage: 'error', progress: 0, message: String(error) });
    }
  }, [modFile, metadata, previewFile, authorId, authorName, authorAvatar, githubToken, onUploadSuccess, onClose, t]);

  const handleReset = useCallback(() => {
    setModFile(null);
    setPreviewFile(null);
    setMetadata({ name: '', description: '', title: '', tags: [], version: '1.0.0' });
    setTagInput('');
    setProgress({ stage: 'idle', progress: 0, message: '' });
  }, []);

  const handleClose = useCallback(() => {
    if (progress.stage !== 'uploading' && progress.stage !== 'committing') {
      handleReset();
      onClose();
    }
  }, [progress.stage, handleReset, onClose]);

  if (!isOpen) return null;

  const isUploading = progress.stage === 'uploading' || progress.stage === 'committing' || progress.stage === 'reading';
  const canSubmit = modFile && metadata.name && metadata.title && !isUploading;

  return (
    <div className="upload-modal-backdrop" onClick={e => e.stopPropagation()}>
      <div className="upload-modal" ref={modalRef}>
        <div className="upload-modal-header">
          <div className="upload-header-title">
            <h2>
              <svg className="upload-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('marketplace.uploadTitle', 'Upload to Marketplace')}
            </h2>
            <span className="upload-modal-subtitle">{t('marketplace.uploadModalDescription', 'Share your mod file with the community')}</span>
          </div>
          <div className="upload-header-actions">
            <button className="upload-modal-help">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
              <div className="upload-help-tooltip" onClick={e => e.stopPropagation()}>
                <div className="upload-help-title">{t('marketplace.uploadHelpTitle', 'How to Use?')}</div>
                <div className="upload-help-content">{t('marketplace.uploadHelpContent', 'Upload your mod to share with the community.')}</div>
                <div className="upload-help-section">
                  <div className="upload-help-section-title">{t('marketplace.uploadHelpFieldsTitle', 'Fields')}</div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpFile', 'Mod File')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpFileDesc', 'Select .fantome file')}</span>
                  </div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpName', 'Mod Name')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpNameDesc', 'Display name')}</span>
                  </div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpTitleField', 'Title')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpTitleDesc', 'Champion or category')}</span>
                  </div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpDesc', 'Description')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpDescInfo', 'Brief info about mod')}</span>
                  </div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpTags', 'Tags')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpTagsDesc', 'Keywords for search')}</span>
                  </div>
                  <div className="upload-help-item">
                    <span className="upload-help-label">{t('marketplace.uploadHelpPreview', 'Preview')}</span>
                    <span className="upload-help-desc">{t('marketplace.uploadHelpPreviewDesc', 'Optional thumbnail image')}</span>
                  </div>
                </div>
              </div>
            </button>
            <button className="upload-modal-close" onClick={handleClose} disabled={isUploading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="upload-modal-content">
          <div className="upload-preview-section">
            <div className={`upload-preview-box ${previewFile ? 'has-file' : ''}`} onClick={handleSelectPreview}>
              {previewFile ? (
                <>
                  <div className="upload-preview-blur" style={{ backgroundImage: `url(${previewFile.base64})` }}></div>
                  <img src={previewFile.base64} alt="Preview" className="upload-preview-image" />
                </>
              ) : (
                <div className="upload-preview-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span>{t('marketplace.uploadSelectImage', 'Click to add preview')}</span>
                </div>
              )}
              <div className="upload-preview-overlay">
                <span>{t('marketplace.editChangeImage', 'Change')}</span>
              </div>
            </div>

            <div className={`upload-file-box ${modFile ? 'has-file' : ''}`} onClick={handleSelectModFile}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              {modFile ? (
                <div className="upload-file-details">
                  <span className="upload-file-name">{modFile.name}</span>
                  <span className="upload-file-size">{(modFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              ) : (
                <>
                  <span className="upload-file-hint">.fantome</span>
                  <span className="upload-file-desc">{t('marketplace.uploadFileBoxDesc', 'Select mod file to upload')}</span>
                </>
              )}
            </div>
          </div>

          <div className="upload-form-section">
            <div className="upload-field">
              <div className="upload-field-header">
                <label>{t('marketplace.uploadName', 'Mod Name')} *</label>
                <span className="upload-field-hint">{t('marketplace.uploadNameHint', 'Display name in marketplace')}</span>
              </div>
              <input type="text" value={metadata.name} onChange={e => setMetadata(prev => ({ ...prev, name: e.target.value }))} 
                placeholder={t('marketplace.uploadNamePlaceholder', 'e.g., Ahri Spirit Blossom')} maxLength={100} />
            </div>

            <div className="upload-field">
              <div className="upload-field-header">
                <label>{t('marketplace.uploadTitleLabel', 'Title')} *</label>
                <span className="upload-field-hint">{t('marketplace.uploadTitleHint', 'Champion or category')}</span>
              </div>
              <input type="text" value={metadata.title} onChange={e => setMetadata(prev => ({ ...prev, title: e.target.value }))} 
                placeholder={t('marketplace.uploadTitlePlaceholder', 'e.g., Ahri, HUD, VFX')} maxLength={50} />
            </div>

            <div className="upload-field">
              <div className="upload-field-header">
                <label>{t('marketplace.uploadDescription', 'Description')}</label>
                <span className="upload-field-hint">{t('marketplace.uploadDescHint', 'Brief info about mod')}</span>
              </div>
              <textarea value={metadata.description} onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))} 
                placeholder={t('marketplace.uploadDescPlaceholder', 'Describe your mod...')} maxLength={500} />
            </div>

            <div className="upload-field">
              <div className="upload-field-header">
                <label>{t('marketplace.uploadTags', 'Tags')} (max 5)</label>
                <span className="upload-field-hint">{t('marketplace.uploadTagsHint', 'Keywords for search')}</span>
              </div>
              <div className="upload-tags-input">
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} 
                  placeholder={t('marketplace.uploadTagPlaceholder', 'Add tag...')} maxLength={20} />
                <button onClick={handleAddTag} disabled={metadata.tags.length >= 5}>+</button>
              </div>
              {metadata.tags.length > 0 && (
                <div className="upload-tags-list">
                  {metadata.tags.map(tag => (
                    <span key={tag} className="upload-tag">
                      <span>{tag}</span>
                      <button onClick={() => handleRemoveTag(tag)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {progress.stage !== 'idle' && (
          <div className={`upload-progress-fixed ${progress.stage}`}>
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${progress.progress}%` }} />
            </div>
            <span className="upload-progress-message">{progress.message}</span>
          </div>
        )}

        <div className="upload-modal-footer">
          <button className="upload-btn cancel" onClick={handleClose} disabled={isUploading}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button className="upload-btn submit" onClick={handleSubmit} disabled={!canSubmit}>
            {isUploading ? <><span className="upload-spinner" />{t('marketplace.uploadUploading', 'Uploading...')}</> : t('marketplace.uploadSubmit', 'Upload')}
          </button>
        </div>
      </div>
    </div>
  );
}

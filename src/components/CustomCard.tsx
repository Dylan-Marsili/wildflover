/**
 * File: CustomCard.tsx
 * Author: Wildflover
 * Description: Custom mod card component with image upload and management features
 *              Uses IndexedDB for thumbnail storage
 * Language: TypeScript/React
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatFileSize, customsStorage } from '../services/customsStorage';
import type { CustomModFile } from '../types/customs';
import './CustomCard.css';

// [PROPS] Component property definitions
interface CustomCardProps {
  mod: CustomModFile;
  onDelete: (modId: string) => void;
  onToggleActive: (modId: string) => void;
  onImageChange: (modId: string, imageData: string) => void;
  onNameChange: (modId: string, name: string) => void;
  isLocked?: boolean;  // When overlay is active, show locked state
}

// [COMPONENT] Custom mod card with image upload and management features
const CustomCard = ({ mod, onDelete, onToggleActive, onImageChange, onNameChange, isLocked = false }: CustomCardProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mod.displayName);
  const [showMenu, setShowMenu] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  // [STATE] Local thumbnail state loaded from IndexedDB
  const [localThumbnail, setLocalThumbnail] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);

  // [EFFECT] Load thumbnail from IndexedDB on mount and when mod changes
  // Reloads when mod.id or mod.updatedAt changes (e.g., after marketplace download)
  useEffect(() => {
    let mounted = true;
    
    const loadThumbnail = async () => {
      setThumbnailLoading(true);
      try {
        const thumbnail = await customsStorage.getThumbnail(mod.id);
        if (mounted) {
          setLocalThumbnail(thumbnail);
          setThumbnailError(false);
        }
      } catch (error) {
        console.error('[CUSTOM-CARD] Failed to load thumbnail:', error);
        if (mounted) {
          setThumbnailError(true);
        }
      } finally {
        if (mounted) {
          setThumbnailLoading(false);
        }
      }
    };
    
    loadThumbnail();
    
    return () => {
      mounted = false;
    };
  }, [mod.id, mod.updatedAt]);

  // [EFFECT] Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside menu and menu button
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };

    // Add listener with slight delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // [HANDLER] Open file picker for image - disabled when locked
  const handleImageClick = useCallback(() => {
    if (isLocked) return;
    fileInputRef.current?.click();
  }, [isLocked]);

  // [HANDLER] Process selected image file
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) {
      console.warn('[CUSTOM-CARD] Invalid file type:', file.type);
      return;
    }

    // Convert to base64 for localStorage
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      // [UPDATE] Update local state immediately for UI feedback
      setLocalThumbnail(imageData);
      onImageChange(mod.id, imageData);
      console.log('[CUSTOM-CARD] Thumbnail updated for:', mod.displayName);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  }, [mod.id, mod.displayName, onImageChange]);

  // [HANDLER] Toggle active state - disabled when locked
  const handleToggleActive = useCallback(() => {
    if (isLocked) return;
    onToggleActive(mod.id);
  }, [mod.id, onToggleActive, isLocked]);

  // [HANDLER] Delete mod - disabled when locked
  const handleDelete = useCallback(() => {
    if (isLocked) return;
    setShowMenu(false);
    onDelete(mod.id);
  }, [mod.id, onDelete, isLocked]);

  // [HANDLER] Start editing name - disabled when locked
  const handleStartEdit = useCallback(() => {
    if (isLocked) return;
    setIsEditing(true);
    setEditName(mod.displayName);
    setShowMenu(false);
  }, [mod.displayName, isLocked]);

  // [HANDLER] Save edited name
  const handleSaveName = useCallback(() => {
    if (editName.trim()) {
      onNameChange(mod.id, editName.trim());
    }
    setIsEditing(false);
  }, [mod.id, editName, onNameChange]);

  // [HANDLER] Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditName(mod.displayName);
  }, [mod.displayName]);

  // [HANDLER] Handle key press in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveName, handleCancelEdit]);

  // [HANDLER] Toggle menu - disabled when locked
  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    setShowMenu(prev => !prev);
  }, [isLocked]);

  // [HANDLER] Show tooltip with position calculation
  const handleToggleMouseEnter = useCallback(() => {
    if (toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left - 8,
        y: rect.top + rect.height / 2
      });
      setShowTooltip(true);
    }
  }, []);

  // [HANDLER] Hide tooltip
  const handleToggleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // [COMPUTED] Thumbnail source with loading state
  const defaultIcon = '/assets/icons/default_mod.jpg';
  const thumbnailSrc = thumbnailError || !localThumbnail ? defaultIcon : localThumbnail;

  // [HANDLER] Handle thumbnail load error
  const handleThumbnailError = useCallback(() => {
    setThumbnailError(true);
  }, []);

  return (
    <div className={`custom-card ${mod.isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}>
      {/* [IMAGE] Thumbnail section */}
      <div className="custom-card-image" onClick={handleImageClick}>
        <img 
          src={thumbnailSrc} 
          alt={mod.displayName}
          className="custom-card-thumbnail"
          onError={handleThumbnailError}
        />
        <div className="custom-card-image-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>{t('customs.changeImage')}</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="custom-card-file-input"
        />
        
        {/* [LOCK] Overlay lock indicator when mods are active */}
        {isLocked && (
          <div className="custom-card-lock-overlay">
            <svg className="lock-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
        )}
      </div>

      {/* [OVERLAY] Gradient overlay */}
      <div className="custom-card-gradient" />

      {/* [BADGE] Source badge - CUSTOMS or MARKETPLACE */}
      <div className={`custom-card-extension ${mod.source === 'marketplace' ? 'marketplace' : ''}`}>
        <span>{mod.source === 'marketplace' ? 'MARKETPLACE' : 'CUSTOMS'}</span>
      </div>

      {/* [MENU] Options menu button */}
      <button ref={menuButtonRef} className="custom-card-menu-btn" onClick={handleMenuToggle}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>

      {/* [DROPDOWN] Options menu */}
      {showMenu && (
        <div ref={menuRef} className="custom-card-dropdown">
          <button className="dropdown-option" onClick={handleStartEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>{t('customs.rename')}</span>
          </button>
          <button className="dropdown-option delete" onClick={handleDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>{t('customs.delete')}</span>
          </button>
        </div>
      )}

      {/* [CONTENT] Card content */}
      <div className="custom-card-content">
        {isEditing ? (
          <div className="custom-card-edit">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveName}
              autoFocus
              className="custom-card-edit-input"
            />
          </div>
        ) : (
          <h3 className="custom-card-name">{mod.displayName}</h3>
        )}
        <div className="custom-card-meta">
          <span className="custom-card-size">{formatFileSize(mod.fileSize)}</span>
          <span className="custom-card-separator">|</span>
          <span className="custom-card-date">
            {new Date(mod.addedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* [TOGGLE] Active toggle button */}
      <button 
        ref={toggleRef}
        className={`custom-card-toggle ${mod.isActive ? 'active' : ''}`}
        onClick={handleToggleActive}
        onMouseEnter={handleToggleMouseEnter}
        onMouseLeave={handleToggleMouseLeave}
      >
        {mod.isActive ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        )}
      </button>

      {/* [TOOLTIP] Portal-based tooltip for z-index fix */}
      {showTooltip && createPortal(
        <div 
          className="custom-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-100%, -50%)'
          }}
        >
          <span className="custom-tooltip-text">
            <span className="custom-tooltip-gradient">
              {mod.isActive ? t('customs.deactivate') : t('customs.activate')}
            </span>
          </span>
          <span className="custom-tooltip-arrow" />
        </div>,
        document.body
      )}

      {/* [INDICATOR] Active state indicator */}
      {mod.isActive && <div className="custom-card-active-indicator" />}
    </div>
  );
};

export default CustomCard;

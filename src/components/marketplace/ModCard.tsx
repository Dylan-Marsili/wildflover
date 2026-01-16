/**
 * File: ModCard.tsx
 * Author: Wildflover
 * Description: Anime-inspired mod card component for marketplace
 * Language: TypeScript/React
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplaceMod } from '../../types/marketplace';
import './ModCard.css';

interface ModCardProps {
  mod: MarketplaceMod;
  isDownloaded: boolean;
  isDownloading: boolean;
  isAdmin: boolean;
  isLiked: boolean;
  onDownload: (mod: MarketplaceMod) => void;
  onLike: (mod: MarketplaceMod) => void;
  onDelete?: (mod: MarketplaceMod) => void;
  onEdit?: (mod: MarketplaceMod) => void;
  onShowLikers?: (mod: MarketplaceMod) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ModCard = memo(({ mod, isDownloaded, isDownloading, isAdmin, isLiked, onDownload, onLike, onDelete, onEdit, onShowLikers }: ModCardProps) => {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // [CONST] Default mod icon path
  const defaultModIcon = '/assets/icons/new_icon.jpg';

  // [MEMO] Build preview URL - supports data URLs for instant updates
  const previewSrc = useMemo(() => {
    if (!mod.previewUrl) return null;
    
    // [DATA-URL] If preview is base64 data URL, use directly
    if (mod.previewUrl.startsWith('data:')) {
      return mod.previewUrl;
    }
    
    // [CDN] For remote URLs, use jsDelivr with cache-busting
    const timestamp = mod.updatedAt ? new Date(mod.updatedAt).getTime() : 0;
    
    // Check if URL already has cache-bust parameter
    if (mod.previewUrl.includes('?t=')) {
      return mod.previewUrl;
    }
    
    // Use jsDelivr CDN
    const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/wiildflover/wildflover-marketplace@main/mods/${mod.id}/preview.jpg`;
    return `${jsdelivrUrl}?t=${timestamp}`;
  }, [mod.id, mod.updatedAt, mod.previewUrl]);

  // [HANDLER] Image load success
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  // [HANDLER] Image load error
  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!isDownloading && !isDownloaded) onDownload(mod);
  }, [mod, isDownloading, isDownloaded, onDownload]);

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(mod);
  }, [mod, onLike]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(mod);
  }, [mod, onDelete]);

  const handleEdit = useCallback(() => {
    if (onEdit) onEdit(mod);
  }, [mod, onEdit]);

  const handleShowLikers = useCallback(() => {
    if (onShowLikers) onShowLikers(mod);
  }, [mod, onShowLikers]);

  return (
    <div className={`mc ${isDownloaded ? 'mc-downloaded' : ''}`}>
      <div className="mc-img">
        {/* [PREVIEW] Show preview image with loading state */}
        {previewSrc && !imageError && (
          <img
            src={previewSrc}
            alt={mod.name}
            className={`mc-preview ${imageLoaded ? 'mc-loaded' : 'mc-loading-img'}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        )}
        
        {/* [FALLBACK] Show default icon only when error or no preview */}
        {(imageError || !previewSrc) && (
          <img
            src={defaultModIcon}
            alt={mod.name}
            className="mc-preview mc-default-icon"
          />
        )}
        
        {/* [ADMIN] Admin action buttons - unified container with divider */}
        {isAdmin && (onEdit || onDelete) && (
          <div className="mc-admin-actions">
            {onEdit && (
              <button className="mc-admin-btn mc-edit" onClick={handleEdit} title={t('marketplace.edit', 'Edit')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {onEdit && onDelete && <span className="mc-admin-divider" />}
            {onDelete && (
              <button className="mc-admin-btn mc-del" onClick={handleDelete} title={t('marketplace.delete', 'Delete')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}

        {isDownloaded && (
          <div className="mc-badge mc-done">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        
        {isDownloading && (
          <div className="mc-badge mc-loading">
            <span className="mc-spin" />
          </div>
        )}

        <button className={`mc-like-float ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
          <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{mod.likedBy?.length || 0}</span>
        </button>
      </div>

      <div className="mc-body">
        <div className="mc-header">
          <h3 className="mc-name">{mod.name}</h3>
          <span className="mc-size">{formatFileSize(mod.fileSize)}</span>
        </div>

        {mod.title && (
          <span className="mc-title-tag">{mod.title}</span>
        )}

        <div className="mc-sharer">
          <div className="mc-sharer-avatar">
            {mod.authorAvatar ? (
              <img 
                src={`https://cdn.discordapp.com/avatars/${mod.authorId}/${mod.authorAvatar}.png?size=64&_=${Math.floor(Date.now() / 300000)}`}
                alt={mod.author}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : null}
            <span className="mc-sharer-initial">{mod.author.charAt(0).toUpperCase()}</span>
          </div>
          <div className="mc-sharer-info">
            <span className="mc-sharer-name">{mod.author}</span>
            <span className="mc-sharer-label">{t('marketplace.sharer', 'Sharer')}</span>
          </div>
        </div>

        {mod.description && (
          <p className="mc-desc">{mod.description}</p>
        )}

        {mod.tags && mod.tags.length > 0 && (
          <div className="mc-tags">
            {mod.tags.slice(0, 3).map(tag => (
              <span key={tag} className="mc-tag">{tag}</span>
            ))}
            {mod.tags.length > 3 && (
              <span className="mc-tag-more">+{mod.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="mc-meta-row">
          <span className="mc-date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {new Date(mod.createdAt).toLocaleDateString()}
          </span>

          <span className="mc-downloads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {mod.downloadCount || 0}
          </span>
        </div>
      </div>

      <div className="mc-footer">
        <button 
          className={`mc-download ${isDownloaded ? 'done' : ''} ${isDownloading ? 'busy' : ''}`}
          onClick={handleDownload}
          disabled={isDownloading || isDownloaded}
        >
          {isDownloaded ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : isDownloading ? (
            <span className="mc-spin-sm" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          <span>{isDownloaded ? t('marketplace.downloaded', 'Downloaded') : isDownloading ? t('marketplace.downloading', 'Downloading...') : t('marketplace.download', 'Download')}</span>
        </button>

        <span className="mc-likers-link" onClick={handleShowLikers}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          {t('marketplace.viewLikers', 'View Likers')}
        </span>
      </div>
    </div>
  );
});

export default ModCard;

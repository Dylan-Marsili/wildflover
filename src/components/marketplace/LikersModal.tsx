/**
 * File: LikersModal.tsx
 * Author: Wildflover
 * Description: Premium modal component displaying users who liked a mod with hero preview
 * Language: TypeScript/React
 */

import { memo, useCallback, useEffect, useState } from 'react';
import type { MarketplaceMod } from '../../types/marketplace';
import './LikersModal.css';

// [PROPS] Component interface definition
interface LikersModalProps {
  isOpen: boolean;
  mod: MarketplaceMod | null;
  onClose: () => void;
}

// [UTIL] Generate Discord avatar URL with cache management
function getAvatarUrl(discordId: string, avatar: string | null): string {
  const cacheBuster = Math.floor(Date.now() / 300000);
  
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128&_=${cacheBuster}`;
  }
  const defaultIndex = parseInt(discordId) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

// [UTIL] Format date to relative time string
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}


// [COMPONENT] Premium likers modal with hero section
const LikersModal = memo(({ isOpen, mod, onClose }: LikersModalProps) => {
  const [previewError, setPreviewError] = useState(false);
  
  // [EFFECT] Reset preview state on mod change
  useEffect(() => {
    setPreviewError(false);
  }, [mod?.id]);

  // [EFFECT] Keyboard escape handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // [HANDLER] Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen || !mod) return null;

  const likers = mod.likedBy || [];

  return (
    <div className="likers-modal-backdrop" onClick={handleBackdropClick}>
      <div className="likers-modal">
        {/* [HEADER] Hero section with background blur */}
        <div className="likers-modal-header">
          <div className="likers-hero-section">
            {!previewError && mod.previewUrl && (
              <img 
                src={mod.previewUrl} 
                alt=""
                className="likers-hero-bg"
                onError={() => setPreviewError(true)}
              />
            )}
            <div className="likers-hero-overlay" />
          </div>
          
          {/* [CLOSE] Close button */}
          <button className="likers-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          {/* [CARD] Mod info card */}
          <div className="likers-mod-card">
            <div className="likers-mod-preview">
              {!previewError && mod.previewUrl ? (
                <img 
                  src={mod.previewUrl} 
                  alt={mod.name}
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="likers-mod-preview-fallback">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="likers-mod-details">
              <h3 className="likers-mod-name">{mod.name}</h3>
              <div className="likers-mod-meta">
                <span className="likers-mod-badge">{mod.title}</span>
                <span className="likers-mod-author">{mod.author}</span>
              </div>
            </div>
          </div>
          
          {/* [STATS] Like counter bar */}
          <div className="likers-stats-bar">
            <svg className="likers-stats-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="likers-stats-count">{likers.length}</span>
            <span className="likers-stats-label">{likers.length === 1 ? 'Like' : 'Likes'}</span>
          </div>
        </div>

        {/* [CONTENT] Users list section */}
        <div className="likers-modal-content">
          {likers.length === 0 ? (
            <div className="likers-modal-empty">
              <div className="likers-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <span className="likers-empty-title">No likes yet</span>
              <p className="likers-empty-desc">Be the first to like this mod</p>
            </div>
          ) : (
            <div className="likers-list">
              {likers.map((liker, index) => (
                <div 
                  key={liker.discordId} 
                  className="liker-item"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div className="liker-avatar-wrapper">
                    <img 
                      src={getAvatarUrl(liker.discordId, liker.avatar)} 
                      alt={liker.displayName}
                      className="liker-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                      }}
                    />
                    <div className="liker-avatar-ring" />
                  </div>
                  <div className="liker-info">
                    <span className="liker-display-name">{liker.displayName}</span>
                    <span className="liker-username">@{liker.username}</span>
                  </div>
                  <span className="liker-date">{formatRelativeDate(liker.likedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default LikersModal;

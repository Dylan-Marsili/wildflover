/**
 * File: DownloadHistoryModal.tsx
 * Author: Wildflover
 * Description: Modal component displaying download history with redownload feature
 * Language: TypeScript/React
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { downloadHistoryService } from '../../services/downloadHistoryService';
import { customsStorage } from '../../services/customsStorage';
import { downloadManager } from '../../services/downloadManager';
import { marketplaceService } from '../../services/marketplaceService';
import type { DownloadHistoryItem } from '../../types/marketplace';
import './DownloadHistoryModal.css';

interface DownloadHistoryModalProps {
  onClose: () => void;
}

// [HELPER] Format file size to human readable
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// [HELPER] Format date to relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
};

const DownloadHistoryModal = memo(({ onClose }: DownloadHistoryModalProps) => {
  const { t } = useTranslation();

  // [STATE] Download history list
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  
  // [STATE] Re-downloading mods set
  const [redownloading, setRedownloading] = useState<Set<string>>(new Set());
  
  // [STATE] Mods that exist in customs storage
  const [existingMods, setExistingMods] = useState<Set<string>>(new Set());
  
  // [STATE] Mods that exist in marketplace catalog
  const [catalogMods, setCatalogMods] = useState<Set<string>>(new Set());
  
  // [STATE] Search query for filtering history
  const [searchQuery, setSearchQuery] = useState('');

  // [EFFECT] Sync and load history
  useEffect(() => {
    const allMods = customsStorage.getAllMods();
    downloadHistoryService.syncFromCustomsStorage(allMods);
    setHistory(downloadHistoryService.getHistory());
    
    // Check which mods exist in customs
    const existing = new Set<string>();
    allMods.forEach(mod => {
      if (mod.id.startsWith('marketplace_')) {
        existing.add(mod.id.replace('marketplace_', ''));
      }
    });
    setExistingMods(existing);
    
    // Fetch catalog to check which mods still exist in marketplace
    marketplaceService.fetchCatalog().then(catalog => {
      const catalogIds = new Set(catalog.mods.map(m => m.id));
      setCatalogMods(catalogIds);
    });
  }, []);

  // [EFFECT] Listen to history and customs changes
  useEffect(() => {
    const updateHistory = () => {
      setHistory(downloadHistoryService.getHistory());
    };
    
    const updateExisting = () => {
      const allMods = customsStorage.getAllMods();
      const existing = new Set<string>();
      allMods.forEach(mod => {
        if (mod.id.startsWith('marketplace_')) {
          existing.add(mod.id.replace('marketplace_', ''));
        }
      });
      setExistingMods(existing);
    };
    
    downloadHistoryService.addChangeListener(updateHistory);
    customsStorage.addChangeListener(updateExisting);
    
    return () => {
      downloadHistoryService.removeChangeListener(updateHistory);
      customsStorage.removeChangeListener(updateExisting);
    };
  }, []);

  // [HANDLER] Remove single item from history
  const handleRemoveItem = useCallback((itemId: string) => {
    downloadHistoryService.removeItem(itemId);
  }, []);

  // [HANDLER] Clear all history
  const handleClearAll = useCallback(() => {
    downloadHistoryService.clearHistory();
  }, []);

  // [HANDLER] Redownload mod from marketplace
  const handleRedownload = useCallback(async (item: DownloadHistoryItem) => {
    if (redownloading.has(item.modId)) return;
    
    setRedownloading(prev => new Set(prev).add(item.modId));
    
    try {
      // Fetch mod from marketplace catalog
      const catalog = await marketplaceService.fetchCatalog();
      const mod = catalog.mods.find(m => m.id === item.modId);
      
      if (mod) {
        await downloadManager.downloadMod(mod);
        console.log('[DOWNLOAD-HISTORY] Redownload completed:', item.modName);
      } else {
        console.error('[DOWNLOAD-HISTORY] Mod not found in catalog:', item.modId);
      }
    } catch (error) {
      console.error('[DOWNLOAD-HISTORY] Redownload failed:', error);
    } finally {
      setRedownloading(prev => {
        const next = new Set(prev);
        next.delete(item.modId);
        return next;
      });
    }
  }, [redownloading]);

  // [COMPUTED] Total size
  const totalSize = downloadHistoryService.getTotalSize();

  // [HELPER] Check if mod is deleted from customs
  const isDeleted = (modId: string) => !existingMods.has(modId);
  
  // [HELPER] Check if mod exists in marketplace catalog
  const isInMarketplace = (modId: string) => catalogMods.has(modId);
  
  // [COMPUTED] Filtered history based on search query
  const filteredHistory = searchQuery.trim() 
    ? history.filter(item => 
        item.modName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.modTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.modAuthor && item.modAuthor.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : history;

  const modalContent = (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={e => e.stopPropagation()}>
        <div className="history-modal-header">
          <div className="history-modal-title-wrapper">
            <div className="history-modal-title-row">
              <svg className="history-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <h2 className="history-modal-title">{t('downloadHistory.title', 'Download History')}</h2>
              <span className="history-modal-count">
                {history.length} {t('downloadHistory.items', 'items')}
              </span>
            </div>
            <span className="history-modal-subtitle">{t('downloadHistory.modalDescription', 'View and manage your downloaded mods')}</span>
          </div>
          <div className="history-header-actions">
            <div className="history-help-wrapper">
              <button className="history-modal-help">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
                </svg>
              </button>
              <div className="history-help-tooltip">
                <div className="history-help-title">{t('downloadHistory.helpTitle', 'How to Use?')}</div>
                <div className="history-help-content">{t('downloadHistory.helpContent', 'View and manage your downloaded mods from this panel.')}</div>
                <div className="history-help-section">
                  <div className="history-help-section-title">{t('downloadHistory.helpStatusTitle', 'Status')}</div>
                  <div className="history-help-item">
                    <span className="history-help-badge completed"></span>
                    <span className="history-help-label">{t('downloadHistory.helpCompletedLabel', 'Installed')}</span>
                    <span className="history-help-desc">{t('downloadHistory.helpCompleted', 'Mod is in your customs')}</span>
                  </div>
                  <div className="history-help-item">
                    <span className="history-help-badge deleted"></span>
                    <span className="history-help-label">{t('downloadHistory.helpDeletedLabel', 'Deleted')}</span>
                    <span className="history-help-desc">{t('downloadHistory.helpDeleted', 'You removed this mod')}</span>
                  </div>
                  <div className="history-help-item">
                    <span className="history-help-badge unavailable"></span>
                    <span className="history-help-label">{t('downloadHistory.helpUnavailableLabel', 'Unavailable')}</span>
                    <span className="history-help-desc">{t('downloadHistory.helpUnavailable', 'Not in marketplace')}</span>
                  </div>
                </div>
              </div>
            </div>
            <button className="history-modal-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history-stats">
            <div className="history-stat">
              <span className="history-stat-value">{filteredHistory.length}</span>
              <span className="history-stat-label">{t('downloadHistory.totalDownloads', 'Downloads')}</span>
            </div>
            <div className="history-stats-separator"></div>
            <div className="history-stat">
              <span className="history-stat-value">{formatFileSize(totalSize)}</span>
              <span className="history-stat-label">{t('downloadHistory.totalSize', 'Total Size')}</span>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="history-search-wrapper">
            <div className="history-search-container">
              <svg className="history-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="history-search-input"
                placeholder={t('downloadHistory.searchPlaceholder', 'Search downloads...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="history-search-clear" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="history-modal-content">
          {history.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <p className="history-empty-text">{t('downloadHistory.empty', 'No downloads yet')}</p>
              <p className="history-empty-hint">{t('downloadHistory.emptyHint', 'Downloaded mods will appear here')}</p>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map(item => {
                const deleted = isDeleted(item.modId);
                const notInMarketplace = !isInMarketplace(item.modId);
                const isRedownloading = redownloading.has(item.modId);
                
                return (
                  <div key={item.id} className={`history-item ${deleted ? 'deleted' : ''} ${notInMarketplace ? 'unavailable' : ''}`}>
                    <div className="history-item-image">
                      <img 
                        src={item.previewUrl || '/assets/icons/default_mod.jpg'} 
                        alt={item.modName}
                        onError={(e) => { e.currentTarget.src = '/assets/icons/default_mod.jpg'; }}
                      />
                      {deleted ? (
                        <div className="history-item-status deleted">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </div>
                      ) : (
                        <div className={`history-item-status ${item.status}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="history-item-info">
                      <div className="history-item-title-row">
                        <span className="history-item-title">{item.modTitle}</span>
                        {notInMarketplace && (
                          <span className="history-unavailable-badge">
                            {t('downloadHistory.notInMarketplace', 'Not in Store')}
                          </span>
                        )}
                        {deleted && !notInMarketplace && (
                          <span className="history-deleted-badge">
                            {t('downloadHistory.deletedByYou', 'Removed by You')}
                          </span>
                        )}
                      </div>
                      <span className="history-item-name">{item.modName}</span>
                      <div className="history-item-meta">
                        {item.modAuthor && (
                          <>
                            <span className="history-item-author">{item.modAuthor}</span>
                            <span className="history-item-separator">|</span>
                          </>
                        )}
                        <span className="history-item-size">{formatFileSize(item.fileSize)}</span>
                      </div>
                      <span className="history-item-date">{formatRelativeTime(item.downloadedAt)}</span>
                    </div>
                    
                    <div className="history-item-actions" onClick={e => e.stopPropagation()}>
                      {deleted && !notInMarketplace && (
                        <div className="action-btn-wrapper">
                          <button 
                            className={`history-action-btn redownload ${isRedownloading ? 'loading' : ''}`}
                            onClick={() => handleRedownload(item)}
                            disabled={isRedownloading}
                          >
                            {isRedownloading ? (
                              <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            )}
                          </button>
                          <span className="action-tooltip redownload-tooltip">
                            {t('downloadHistory.redownload', 'Redownload')}
                          </span>
                        </div>
                      )}
                      <div className="action-btn-wrapper">
                        <button 
                          className="history-action-btn remove"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                        <span className="action-tooltip">{t('downloadHistory.remove', 'Remove')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="history-modal-footer">
            <button className="history-clear-all" onClick={handleClearAll}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              {t('downloadHistory.clearAll', 'Clear History')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

export default DownloadHistoryModal;

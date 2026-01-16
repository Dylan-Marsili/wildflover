/**
 * File: MarketplaceScreen.tsx
 * Author: Wildflover
 * Description: Main marketplace screen with mod browsing, filtering and download
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { marketplaceService } from '../services/marketplaceService';
import { customsStorage } from '../services/customsStorage';
import { downloadManager } from '../services/downloadManager';
import { isMarketplaceAdmin } from '../config/marketplace.config';
import ModCard from '../components/marketplace/ModCard';
import UploadModal from '../components/marketplace/UploadModal';
import DeleteModal from '../components/marketplace/DeleteModal';
import LikersModal from '../components/marketplace/LikersModal';
import EditModal from '../components/marketplace/EditModal';
import DownloadHistoryModal from '../components/marketplace/DownloadHistoryModal';
import type { ModUpdateData } from '../components/marketplace/EditModal';
import type { MarketplaceMod, MarketplaceCatalog, MarketplaceFilters } from '../types/marketplace';
import './MarketplaceScreen.css';

// [PROPS] Component properties
interface MarketplaceScreenProps {
  discordUserId?: string;
  discordUsername?: string;
  discordDisplayName?: string;
  discordAvatar?: string | null;
  githubToken?: string;
}

// [COMPONENT] Main marketplace screen
export default function MarketplaceScreen({ 
  discordUserId, 
  discordUsername,
  discordDisplayName,
  discordAvatar,
  githubToken 
}: MarketplaceScreenProps) {
  const { t } = useTranslation();
  
  // [STATE] Data states
  const [catalog, setCatalog] = useState<MarketplaceCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // [STATE] Filter states - load sortBy from localStorage
  const [filters, setFilters] = useState<MarketplaceFilters>(() => {
    const savedSort = localStorage.getItem('wildflover_marketplace_sort');
    return {
      title: null,
      tags: [],
      author: null,
      searchQuery: '',
      sortBy: (savedSort as MarketplaceFilters['sortBy']) || 'newest'
    };
  });
  
  // [STATE] Download states
  const [downloadingMods, setDownloadingMods] = useState<Set<string>>(new Set());
  const [downloadedMods, setDownloadedMods] = useState<Set<string>>(new Set());
  
  // [STATE] Like states
  const [likedMods, setLikedMods] = useState<Set<string>>(new Set());
  
  // [STATE] Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modToDelete, setModToDelete] = useState<MarketplaceMod | null>(null);
  
  // [STATE] Likers modal
  const [likersModalOpen, setLikersModalOpen] = useState(false);
  const [selectedModForLikers, setSelectedModForLikers] = useState<MarketplaceMod | null>(null);
  
  // [STATE] Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modToEdit, setModToEdit] = useState<MarketplaceMod | null>(null);
  
  // [STATE] Download history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  
  // [STATE] Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // [STATE] Title filter modal
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [titleSearchQuery, setTitleSearchQuery] = useState('');

  // [STATE] Pagination - Dynamic items per page based on screen size
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // [EFFECT] Calculate items per page based on window size
  useEffect(() => {
    const calculateItemsPerPage = () => {
      const width = window.innerWidth;
      
      // Calculate based on screen width - always show 1 row of cards
      if (width >= 2560) {
        setItemsPerPage(7);  // Ultra-wide: 7 columns
      } else if (width >= 1920) {
        setItemsPerPage(6);  // Full HD: 6 columns
      } else {
        setItemsPerPage(5);  // Default 1280px: 5 columns
      }
    };

    calculateItemsPerPage();
    window.addEventListener('resize', calculateItemsPerPage);
    return () => window.removeEventListener('resize', calculateItemsPerPage);
  }, []);

  // [STATE] Sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // [MEMO] Check if current user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  // [EFFECT] Load catalog on mount - always fetch fresh data
  useEffect(() => {
    loadCatalog(true); // forceRefresh: true for always up-to-date data
  }, []);

  // [EFFECT] Load liked mods from localStorage AND sync with catalog likedBy
  useEffect(() => {
    const storedLikes = localStorage.getItem('wildflover_marketplace_likes');
    if (storedLikes) {
      try {
        const likes = JSON.parse(storedLikes) as string[];
        setLikedMods(new Set(likes));
        console.log('[MARKETPLACE] Loaded liked mods from localStorage:', likes.length);
      } catch (e) {
        console.warn('[MARKETPLACE] Failed to parse liked mods');
      }
    }
  }, []);

  // [EFFECT] Sync likedMods with catalog likedBy arrays (source of truth)
  // This ensures UI reflects actual server state after catalog refresh
  useEffect(() => {
    if (!catalog || !discordUserId) return;
    
    const serverLikedMods = new Set<string>();
    
    // Check each mod's likedBy array for current user
    catalog.mods.forEach(mod => {
      if (mod.likedBy && mod.likedBy.some(l => l.discordId === discordUserId)) {
        serverLikedMods.add(mod.id);
      }
    });
    
    // Update likedMods to match server state
    setLikedMods(serverLikedMods);
    
    // Persist to localStorage
    localStorage.setItem('wildflover_marketplace_likes', JSON.stringify([...serverLikedMods]));
    
    console.log('[MARKETPLACE] Synced liked mods with catalog:', serverLikedMods.size);
  }, [catalog, discordUserId]);

  // [EFFECT] Check admin status after catalog loads
  useEffect(() => {
    if (discordUserId && catalog) {
      const adminStatus = isMarketplaceAdmin(discordUserId);
      setIsAdmin(adminStatus);
      console.log('[MARKETPLACE] Admin check:', discordUserId, adminStatus);
    }
  }, [discordUserId, catalog]);

  // [EFFECT] Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // [EFFECT] Subscribe to global download manager for persistent download state
  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((downloads) => {
      const downloading = new Set<string>();
      const completed = new Set<string>();
      
      downloads.forEach((progress, modId) => {
        if (progress.status === 'downloading' || progress.status === 'pending') {
          downloading.add(modId);
        }
        if (progress.status === 'completed') {
          completed.add(modId);
        }
      });
      
      setDownloadingMods(downloading);
      
      // Merge completed downloads with existing downloaded mods
      if (completed.size > 0) {
        setDownloadedMods(prev => {
          const next = new Set(prev);
          completed.forEach(id => next.add(id));
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // [FUNC] Load marketplace catalog
  const loadCatalog = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await marketplaceService.fetchCatalog(forceRefresh);
      setCatalog(data);
      
      // [CHECK] Which mods are already in customs storage
      const downloaded = new Set<string>();
      data.mods.forEach(mod => {
        const existsInCustoms = customsStorage.getMod(`marketplace_${mod.id}`);
        if (existsInCustoms) {
          downloaded.add(mod.id);
        }
      });
      setDownloadedMods(downloaded);
      
      console.log('[MARKETPLACE] Catalog loaded, downloaded mods:', downloaded.size);
      
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // [HANDLER] Download mod via global download manager
  const handleDownload = useCallback(async (mod: MarketplaceMod) => {
    // Check if already downloading via global manager
    if (downloadManager.isDownloading(mod.id)) {
      console.log('[MARKETPLACE] Already downloading via manager:', mod.name);
      return;
    }
    
    // Check if already exists in customs
    const existingMod = customsStorage.getMod(`marketplace_${mod.id}`);
    if (existingMod) {
      console.log('[MARKETPLACE] Mod already exists in customs:', mod.name);
      setDownloadedMods(prev => new Set(prev).add(mod.id));
      return;
    }
    
    console.log('[MARKETPLACE] Starting download via manager:', mod.name);
    
    // Use global download manager - persists across navigation
    const success = await downloadManager.downloadMod(mod);
    
    if (success) {
      // Update catalog with new download count
      setCatalog(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          mods: prev.mods.map(m => {
            if (m.id === mod.id) {
              return { ...m, downloadCount: (m.downloadCount || 0) + 1 };
            }
            return m;
          })
        };
      });
      
      console.log('[MARKETPLACE] Download completed via manager:', mod.name);
    }
  }, []);

  // [HANDLER] Like mod
  const handleLike = useCallback(async (mod: MarketplaceMod) => {
    const isCurrentlyLiked = likedMods.has(mod.id);
    
    // Prepare user info for like tracking with correct Discord data
    const userInfo = discordUserId ? {
      discordId: discordUserId,
      username: discordUsername || 'Unknown',
      displayName: discordDisplayName || discordUsername || 'Unknown',
      avatar: discordAvatar || null
    } : undefined;
    
    // Update local state immediately for responsive UI
    setLikedMods(prev => {
      const next = new Set(prev);
      if (isCurrentlyLiked) {
        next.delete(mod.id);
      } else {
        next.add(mod.id);
      }
      // Save to localStorage
      localStorage.setItem('wildflover_marketplace_likes', JSON.stringify([...next]));
      return next;
    });

    // Update catalog state for immediate UI feedback
    setCatalog(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        mods: prev.mods.map(m => {
          if (m.id === mod.id) {
            const likedBy = m.likedBy || [];
            let updatedLikedBy = [...likedBy];
            
            if (!isCurrentlyLiked && userInfo) {
              // [ADD] Only add if user NOT already in likedBy array
              const alreadyExists = updatedLikedBy.some(l => l.discordId === userInfo.discordId);
              if (!alreadyExists) {
                updatedLikedBy.push({
                  ...userInfo,
                  likedAt: new Date().toISOString()
                });
              }
            } else if (isCurrentlyLiked && userInfo) {
              // [REMOVE] Filter out current user
              updatedLikedBy = updatedLikedBy.filter(l => l.discordId !== userInfo.discordId);
            }
            
            // [SYNC] likeCount MUST equal likedBy.length for data consistency
            return {
              ...m,
              likeCount: updatedLikedBy.length,
              likedBy: updatedLikedBy
            };
          }
          return m;
        })
      };
    });

    // Send like/unlike to backend
    try {
      await marketplaceService.likeMod(mod.id, !isCurrentlyLiked, userInfo);
      console.log('[MARKETPLACE] Like updated:', mod.id, !isCurrentlyLiked);
    } catch (err) {
      console.error('[MARKETPLACE] Like failed:', err);
      // Revert on error
      setLikedMods(prev => {
        const next = new Set(prev);
        if (isCurrentlyLiked) {
          next.add(mod.id);
        } else {
          next.delete(mod.id);
        }
        localStorage.setItem('wildflover_marketplace_likes', JSON.stringify([...next]));
        return next;
      });
    }
  }, [likedMods, discordUserId, discordUsername, discordDisplayName, discordAvatar]);

  // [HANDLER] Search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
  }, []);

  // [HANDLER] Sort change - save to localStorage
  const handleSortChange = useCallback((sortBy: MarketplaceFilters['sortBy']) => {
    setFilters(prev => ({ ...prev, sortBy }));
    localStorage.setItem('wildflover_marketplace_sort', sortBy);
    setSortDropdownOpen(false);
  }, []);

  // [HANDLER] Title filter
  const handleTitleFilter = useCallback((title: string | null) => {
    setFilters(prev => ({ ...prev, title }));
  }, []);

  // [HANDLER] Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      title: null,
      tags: [],
      author: null,
      searchQuery: '',
      sortBy: 'newest'
    });
  }, []);

  // [HANDLER] Upload success - smooth catalog update without full page refresh
  const handleUploadSuccess = useCallback(async () => {
    console.log('[MARKETPLACE] Upload success, updating catalog...');
    
    // Clear service cache
    marketplaceService.clearCache();
    
    // Small delay for GitHub API propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch fresh catalog without resetting loading state (smooth update)
    try {
      const freshCatalog = await marketplaceService.fetchCatalog(true);
      setCatalog(freshCatalog);
      console.log('[MARKETPLACE] Catalog updated:', freshCatalog.mods.length, 'mods');
    } catch (err) {
      console.error('[MARKETPLACE] Update failed:', err);
    }
  }, []);

  // [HANDLER] Open delete modal (admin only)
  const handleDeleteMod = useCallback((mod: MarketplaceMod) => {
    setModToDelete(mod);
    setDeleteModalOpen(true);
  }, []);

  // [HANDLER] Confirm delete - actually delete from GitHub
  const handleConfirmDelete = useCallback(async (mod: MarketplaceMod) => {
    console.log('[MARKETPLACE] Deleting mod:', mod.id);
    
    const result = await marketplaceService.deleteMod(mod.id);
    
    if (result.success) {
      // Update local catalog state
      setCatalog(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          mods: prev.mods.filter(m => m.id !== mod.id),
          totalMods: prev.totalMods - 1
        };
      });
      
      // Close modal
      setDeleteModalOpen(false);
      setModToDelete(null);
      
      console.log('[MARKETPLACE] Mod deleted successfully');
    } else {
      throw new Error(result.error || 'Delete failed');
    }
  }, []);

  // [HANDLER] Cancel delete
  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setModToDelete(null);
  }, []);

  // [HANDLER] Show likers modal
  const handleShowLikers = useCallback((mod: MarketplaceMod) => {
    setSelectedModForLikers(mod);
    setLikersModalOpen(true);
  }, []);

  // [HANDLER] Close likers modal
  const handleCloseLikers = useCallback(() => {
    setLikersModalOpen(false);
    setSelectedModForLikers(null);
  }, []);

  // [HANDLER] Open edit modal (admin only)
  const handleEditMod = useCallback((mod: MarketplaceMod) => {
    setModToEdit(mod);
    setEditModalOpen(true);
  }, []);

  // [HANDLER] Save edit changes
  const handleSaveEdit = useCallback(async (modId: string, updates: ModUpdateData) => {
    console.log('[MARKETPLACE] Saving edit:', modId, updates);
    
    const result = await marketplaceService.updateMod(
      modId,
      {
        name: updates.name,
        title: updates.title,
        description: updates.description,
        tags: updates.tags
      }
    );

    if (result.success) {
      // Update local catalog state
      setCatalog(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          mods: prev.mods.map(m => {
            if (m.id === modId) {
              return {
                ...m,
                name: updates.name,
                title: updates.title,
                description: updates.description,
                tags: updates.tags,
                updatedAt: new Date().toISOString()
              };
            }
            return m;
          })
        };
      });
      
      setEditModalOpen(false);
      setModToEdit(null);
      console.log('[MARKETPLACE] Mod updated successfully');
    } else {
      throw new Error(result.error || 'Update failed');
    }
  }, []);

  // [HANDLER] Close edit modal
  const handleCloseEdit = useCallback(() => {
    setEditModalOpen(false);
    setModToEdit(null);
  }, []);

  // [MEMO] Filtered and sorted mods
  const filteredMods = useMemo(() => {
    if (!catalog) return [];
    let mods = marketplaceService.filterMods(catalog.mods, {
      ...filters,
      sortBy: filters.sortBy === 'downloaded' ? 'newest' : filters.sortBy
    });
    
    // [SORT] Downloaded sort - show downloaded mods first (user's library)
    if (filters.sortBy === 'downloaded') {
      mods = mods.sort((a, b) => {
        const aDownloaded = downloadedMods.has(a.id) ? 1 : 0;
        const bDownloaded = downloadedMods.has(b.id) ? 1 : 0;
        return bDownloaded - aDownloaded;
      });
    }
    
    return mods;
  }, [catalog, filters, downloadedMods]);

  // [MEMO] Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil(filteredMods.length / itemsPerPage);
  }, [filteredMods.length, itemsPerPage]);

  // [MEMO] Paginated mods for current page
  const paginatedMods = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMods.slice(startIndex, endIndex);
  }, [filteredMods, currentPage, itemsPerPage]);

  // [EFFECT] Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // [HANDLER] Page navigation
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of content
      const content = document.querySelector('.marketplace-content');
      if (content) content.scrollTop = 0;
    }
  }, [totalPages]);

  // [MEMO] Available titles for filter
  const availableTitles = useMemo(() => {
    return marketplaceService.getAvailableTitles();
  }, [catalog]);

  // [RENDER] Loading state
  if (loading && !catalog) {
    return (
      <div className="marketplace-screen">
        <div className="marketplace-loading">
          <div className="marketplace-loading-spinner" />
          <span>Loading marketplace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-screen">
      {/* [BACKGROUND] Wildflover themed background */}
      <div className="marketplace-bg">
        <img src="/assets/backgrounds/wildflover_bg.jpg" alt="" />
        <div className="marketplace-bg-overlay" />
      </div>

      {/* [TOOLBAR] Modern header with title */}
      <div className="marketplace-header">
        <div className="marketplace-header-left">
          <div className="marketplace-title-wrapper">
            <div className="marketplace-title-row">
              <h1 className="marketplace-title">Marketplace</h1>
              <span className="marketplace-count">{filteredMods.length} {t('marketplace.mods', 'mods')}</span>
            </div>
            <span className="marketplace-subtitle">{t('marketplace.subtitle', 'Browse and download community mods')}</span>
          </div>
        </div>

        <div className="marketplace-header-right">
          {/* [SORT] Custom sort dropdown */}
          <div className="sort-dropdown" ref={sortDropdownRef}>
            <button 
              className={`sort-dropdown-trigger ${sortDropdownOpen ? 'open' : ''}`}
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            >
              <span>
                {filters.sortBy === 'newest' && t('marketplace.sortNewest', 'Newest')}
                {filters.sortBy === 'popular' && t('marketplace.sortPopular', 'Popular')}
                {filters.sortBy === 'mostDownloaded' && t('marketplace.sortMostDownloaded', 'Most Downloaded')}
                {filters.sortBy === 'name' && t('marketplace.sortName', 'Name')}
                {filters.sortBy === 'size' && t('marketplace.sortSize', 'Size')}
                {filters.sortBy === 'downloaded' && t('marketplace.sortDownloaded', 'Downloaded')}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            
            {sortDropdownOpen && (
              <div className="sort-dropdown-menu">
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'newest' ? 'active' : ''}`}
                  onClick={() => handleSortChange('newest')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{t('marketplace.sortNewest', 'Newest')}</span>
                </button>
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'popular' ? 'active' : ''}`}
                  onClick={() => handleSortChange('popular')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span>{t('marketplace.sortPopular', 'Popular')}</span>
                </button>
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'mostDownloaded' ? 'active' : ''}`}
                  onClick={() => handleSortChange('mostDownloaded')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v10m0 0l3-3m-3 3l-3-3" />
                    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
                    <path d="M8 18h.01M12 18h.01M16 18h.01" />
                  </svg>
                  <span>{t('marketplace.sortMostDownloaded', 'Most Downloaded')}</span>
                </button>
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => handleSortChange('name')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="9" x2="20" y2="9" />
                    <line x1="4" y1="15" x2="14" y2="15" />
                    <line x1="4" y1="21" x2="8" y2="21" />
                  </svg>
                  <span>{t('marketplace.sortName', 'Name')}</span>
                </button>
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'size' ? 'active' : ''}`}
                  onClick={() => handleSortChange('size')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  <span>{t('marketplace.sortSize', 'Size')}</span>
                </button>
                <button 
                  className={`sort-dropdown-item ${filters.sortBy === 'downloaded' ? 'active' : ''}`}
                  onClick={() => handleSortChange('downloaded')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{t('marketplace.sortDownloaded', 'Downloaded')}</span>
                </button>
              </div>
            )}
          </div>

          {/* [REFRESH] Refresh button with tooltip */}
          <div className="marketplace-refresh-wrapper">
            <button className="marketplace-refresh" onClick={() => loadCatalog(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <div className="marketplace-refresh-tooltip">
              <span>{t('marketplace.refreshTooltip', 'Refresh Marketplace')}</span>
            </div>
          </div>

          {/* [HISTORY] Download history button with tooltip */}
          <div className="marketplace-history-wrapper">
            <button 
              className="marketplace-history-btn"
              onClick={() => setHistoryModalOpen(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
            <div className="marketplace-history-tooltip">
              <span>{t('downloadHistory.title', 'Download History')}</span>
            </div>
          </div>

          {/* [UPLOAD] Upload button (admin only) */}
          {isAdmin && (
            <button 
              className="marketplace-upload-btn"
              onClick={() => setShowUploadModal(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{t('marketplace.upload', 'Upload')}</span>
            </button>
          )}
        </div>
      </div>

      {/* [FILTERS] Title filter bar with search */}
      <div className="marketplace-filters-row">
        <div className="marketplace-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t('marketplace.searchPlaceholder', 'Search...')}
            value={filters.searchQuery}
            onChange={handleSearchChange}
          />
          {filters.searchQuery && (
            <button 
              className="search-clear"
              onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {availableTitles.length > 0 && (
          <div className="marketplace-filters">
            <button
              className={`filter-chip ${!filters.title ? 'active' : ''}`}
              onClick={() => handleTitleFilter(null)}
            >
              {t('marketplace.all', 'All')}
            </button>
            {availableTitles.slice(0, 5).map(item => (
              <button
                key={item.id}
                className={`filter-chip ${filters.title === item.name ? 'active' : ''}`}
                onClick={() => handleTitleFilter(item.name)}
              >
                {item.name}
                <span className="filter-count">{item.count}</span>
              </button>
            ))}
            {availableTitles.length > 5 && (
              <button 
                className="filter-chip filter-more"
                onClick={() => setTitleModalOpen(true)}
              >
                +{availableTitles.length - 5} {t('marketplace.more', 'more')}
              </button>
            )}
            {(filters.title || filters.searchQuery) && (
              <button className="filter-clear" onClick={handleClearFilters}>
                {t('marketplace.clear', 'Clear')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* [MODAL] Title filter modal - Professional design with search */}
      {titleModalOpen && (
        <div className="title-modal-backdrop" onClick={() => { setTitleModalOpen(false); setTitleSearchQuery(''); }}>
          <div className="title-modal" onClick={e => e.stopPropagation()}>
            <div className="title-modal-header">
              <div className="title-modal-header-left">
                <svg className="title-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <div className="title-modal-header-text">
                  <div className="title-modal-title-row">
                    <h3>{t('marketplace.filterByTitle', 'Filter by Title')}</h3>
                    <span className="title-modal-badge">{availableTitles.length} {t('marketplace.categories', 'Categories')}</span>
                  </div>
                  <p className="title-modal-subtitle">{t('marketplace.filterByTitleDesc', 'Quickly find mods by selecting a champion or category')}</p>
                </div>
              </div>
              <div className="title-modal-actions">
                <button className="title-modal-help">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                  </svg>
                  <div className="title-help-tooltip">
                    <div className="title-help-title">{t('marketplace.filterHelpTitle', 'How to Use?')}</div>
                    <div className="title-help-content">{t('marketplace.filterHelpContent', 'Filter mods by champion name or category to find what you need quickly.')}</div>
                    <div className="title-help-section">
                      <div className="title-help-section-title">{t('marketplace.filterHelpActionsTitle', 'Actions')}</div>
                      <div className="title-help-item">
                        <span className="title-help-label">{t('marketplace.filterHelpSearch', 'Search')}</span>
                        <span className="title-help-desc">{t('marketplace.filterHelpSearchDesc', 'Type to filter categories')}</span>
                      </div>
                      <div className="title-help-item">
                        <span className="title-help-label">{t('marketplace.filterHelpSelect', 'Select')}</span>
                        <span className="title-help-desc">{t('marketplace.filterHelpSelectDesc', 'Click category to apply filter')}</span>
                      </div>
                      <div className="title-help-item">
                        <span className="title-help-label">{t('marketplace.filterHelpAll', 'All')}</span>
                        <span className="title-help-desc">{t('marketplace.filterHelpAllDesc', 'Show all mods without filter')}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <button className="title-modal-close" onClick={() => { setTitleModalOpen(false); setTitleSearchQuery(''); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* [SEARCH] Search input */}
            <div className="title-modal-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={t('marketplace.searchTitles', 'Search titles...')}
                value={titleSearchQuery}
                onChange={(e) => setTitleSearchQuery(e.target.value)}
                autoFocus
              />
              {titleSearchQuery && (
                <button className="title-search-clear" onClick={() => setTitleSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* [STATS] Quick stats */}
            <div className="title-modal-stats">
              <span className="title-stat-item">
                <span className="title-stat-value">{availableTitles.length}</span>
                <span className="title-stat-label">{t('marketplace.categories', 'Categories')}</span>
              </span>
              <span className="title-stat-divider" />
              <span className="title-stat-item">
                <span className="title-stat-value">{catalog?.mods.length || 0}</span>
                <span className="title-stat-label">{t('marketplace.totalMods', 'Total Mods')}</span>
              </span>
            </div>
            
            <div className="title-modal-content">
              {/* [ALL] All option */}
              <button
                className={`title-modal-item all-item ${!filters.title ? 'active' : ''}`}
                onClick={() => { handleTitleFilter(null); setTitleModalOpen(false); setTitleSearchQuery(''); }}
              >
                <div className="title-item-content">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span>{t('marketplace.all', 'All')}</span>
                </div>
                <span className="title-modal-count">{catalog?.mods.length || 0}</span>
              </button>
              
              {/* [FILTERED] Filtered titles */}
              {availableTitles
                .filter(item => 
                  !titleSearchQuery || 
                  item.name.toLowerCase().includes(titleSearchQuery.toLowerCase())
                )
                .map(item => (
                  <button
                    key={item.id}
                    className={`title-modal-item ${filters.title === item.name ? 'active' : ''}`}
                    onClick={() => { handleTitleFilter(item.name); setTitleModalOpen(false); setTitleSearchQuery(''); }}
                  >
                    <div className="title-item-content">
                      <span className="title-item-name">{item.name}</span>
                    </div>
                    <span className="title-modal-count">{item.count}</span>
                  </button>
                ))}
              
              {/* [EMPTY] No results */}
              {titleSearchQuery && availableTitles.filter(item => 
                item.name.toLowerCase().includes(titleSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="title-modal-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span>{t('marketplace.noTitlesFound', 'No titles found')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* [CONTENT] Mod grid */}
      <div className="marketplace-content">
        {error ? (
          <div className="marketplace-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            <button onClick={() => loadCatalog(true)}>{t('marketplace.retry', 'Retry')}</button>
          </div>
        ) : filteredMods.length === 0 ? (
          <div className="marketplace-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>
              {filters.searchQuery || filters.title 
                ? t('marketplace.noModsMatch', 'No mods match your filters')
                : t('marketplace.noModsYet', 'No mods available yet')}
            </span>
          </div>
        ) : (
          <>
            <div className="marketplace-grid">
              {paginatedMods.map((mod, index) => (
                <ModCard
                  key={`${mod.id}-${currentPage}-${index}`}
                  mod={mod}
                  isDownloaded={downloadedMods.has(mod.id)}
                  isDownloading={downloadingMods.has(mod.id)}
                  isAdmin={isAdmin}
                  isLiked={likedMods.has(mod.id)}
                  onDownload={handleDownload}
                  onLike={handleLike}
                  onDelete={handleDeleteMod}
                  onEdit={handleEditMod}
                  onShowLikers={handleShowLikers}
                />
              ))}
            </div>

            {/* [PAGINATION] Page navigation */}
            {totalPages > 1 && (
              <div className="marketplace-pagination">
                <button 
                  className="pagination-btn pagination-prev"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Show first, last, current and adjacent pages
                    const showPage = page === 1 || 
                                     page === totalPages || 
                                     Math.abs(page - currentPage) <= 1;
                    
                    // Show ellipsis
                    const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                    const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                    if (showEllipsisBefore || showEllipsisAfter) {
                      return <span key={page} className="pagination-ellipsis">...</span>;
                    }

                    if (!showPage) return null;

                    return (
                      <button
                        key={page}
                        className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button 
                  className="pagination-btn pagination-next"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                <span className="pagination-info">
                  {currentPage} / {totalPages}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* [MODAL] Upload modal */}
      {isAdmin && (
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          authorId={discordUserId || ''}
          authorName={discordUsername || 'Unknown'}
          authorAvatar={discordAvatar || null}
          githubToken={githubToken || ''}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* [MODAL] Delete confirmation modal */}
      {isAdmin && (
        <DeleteModal
          isOpen={deleteModalOpen}
          mod={modToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* [MODAL] Likers modal */}
      <LikersModal
        isOpen={likersModalOpen}
        mod={selectedModForLikers}
        onClose={handleCloseLikers}
      />

      {/* [MODAL] Edit modal (admin only) */}
      {isAdmin && (
        <EditModal
          isOpen={editModalOpen}
          mod={modToEdit}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      )}

      {/* [MODAL] Download history modal */}
      {historyModalOpen && (
        <DownloadHistoryModal onClose={() => setHistoryModalOpen(false)} />
      )}
    </div>
  );
}

/**
 * File: TutorialModal.tsx
 * Author: Wildflover
 * Description: Professional 10-page tutorial modal system with first-time user detection
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './TutorialModal.css';

// [TYPE] Tutorial page structure
interface TutorialPage {
  title: string;
  description: string;
  image: string;
  tips?: string[];
}

// [PROPS] Component props
interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// [CONSTANTS] Storage key for first-time detection
const TUTORIAL_COMPLETED_KEY = 'wildflover_tutorial_completed';

// [COMPONENT] Tutorial modal with 10-page guide system
const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);

  // [EFFECT] Reset to first page when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  // [PAGES] Tutorial page definitions
  const pages: TutorialPage[] = [
    {
      title: t('tutorial.welcome.title', 'Welcome to Wildflover'),
      description: t('tutorial.welcome.desc', 'Professional League of Legends skin manager with modern interface. This guide will show you all features and how to use them effectively.'),
      image: '/assets/learning/home_preview.png',
      tips: [
        t('tutorial.welcome.tip1', 'Navigate through pages using arrow buttons'),
        t('tutorial.welcome.tip2', 'You can skip this tutorial anytime'),
        t('tutorial.welcome.tip3', 'This tutorial only shows once')
      ]
    },
    {
      title: t('tutorial.home.title', 'Champions Library'),
      description: t('tutorial.home.desc', 'Browse all League of Legends champions and their skins. Use search and filters to find specific champions quickly. Click on any champion card to view their available skins.'),
      image: '/assets/learning/championslibrary_preview.png',
      tips: [
        t('tutorial.home.tip1', 'Search champions by name'),
        t('tutorial.home.tip2', 'Filter by role or region'),
        t('tutorial.home.tip3', 'Click champion card to open skin selector')
      ]
    },
    {
      title: t('tutorial.skinpage.title', 'Skin Selection'),
      description: t('tutorial.skinpage.desc', 'View all available skins for a champion. Select your favorite skin to activate in-game. Each skin shows high-quality splash art and detailed information.'),
      image: '/assets/learning/skinpage_preview.png',
      tips: [
        t('tutorial.skinpage.tip1', 'Browse all skins with smooth animations'),
        t('tutorial.skinpage.tip2', 'Click skin card to select'),
        t('tutorial.skinpage.tip3', 'Selected skins are highlighted')
      ]
    },
    {
      title: t('tutorial.chroma.title', 'Chroma Variants'),
      description: t('tutorial.chroma.desc', 'Many skins have chroma variants with different color schemes. Select chromas to customize your skin appearance even further.'),
      image: '/assets/learning/chroma_preview.png',
      tips: [
        t('tutorial.chroma.tip1', 'Chromas change skin colors'),
        t('tutorial.chroma.tip2', 'Not all skins have chromas'),
        t('tutorial.chroma.tip3', 'Preview chroma colors before selecting')
      ]
    },
    {
      title: t('tutorial.selectedskins.title', 'Selected Skins Overview'),
      description: t('tutorial.selectedskins.desc', 'View all your selected skins in one place. Manage your selections, remove unwanted skins, or activate all at once.'),
      image: '/assets/learning/selectedskins_preview.png',
      tips: [
        t('tutorial.selectedskins.tip1', 'Access via floating action button'),
        t('tutorial.selectedskins.tip2', 'Remove individual selections'),
        t('tutorial.selectedskins.tip3', 'Activate all skins with one click')
      ]
    },
    {
      title: t('tutorial.customs.title', 'Custom Mods'),
      description: t('tutorial.customs.desc', 'Import and manage custom mods from your local files. Supports .fantome and .zip formats. Organize your custom content easily.'),
      image: '/assets/learning/customs_preview.png',
      tips: [
        t('tutorial.customs.tip1', 'Drag & drop mod files to import'),
        t('tutorial.customs.tip2', 'Supports .fantome and .zip formats'),
        t('tutorial.customs.tip3', 'Manage custom mods separately')
      ]
    },
    {
      title: t('tutorial.marketplace.title', 'Marketplace'),
      description: t('tutorial.marketplace.desc', 'Discover and download community-created mods. Browse thousands of custom skins, effects, and modifications shared by other users.'),
      image: '/assets/learning/marketplace_preview.png',
      tips: [
        t('tutorial.marketplace.tip1', 'Browse community mods'),
        t('tutorial.marketplace.tip2', 'Like your favorite mods'),
        t('tutorial.marketplace.tip3', 'Download with one click')
      ]
    },
    {
      title: t('tutorial.marketplace_filter.title', 'Marketplace Filters'),
      description: t('tutorial.marketplace_filter.desc', 'Use advanced filters to find exactly what you need. Sort by popularity, date, or likes. Filter by categories and tags.'),
      image: '/assets/learning/marketplace_filtre_preview.png',
      tips: [
        t('tutorial.marketplace_filter.tip1', 'Sort by multiple criteria'),
        t('tutorial.marketplace_filter.tip2', 'Filter by categories'),
        t('tutorial.marketplace_filter.tip3', 'Search by title or author')
      ]
    },
    {
      title: t('tutorial.downloadhistory.title', 'Download History'),
      description: t('tutorial.downloadhistory.desc', 'Track all your downloaded mods from marketplace. Re-download or manage your download history easily.'),
      image: '/assets/learning/downloadhistory_preview.png',
      tips: [
        t('tutorial.downloadhistory.tip1', 'View all downloaded mods'),
        t('tutorial.downloadhistory.tip2', 'Re-download anytime'),
        t('tutorial.downloadhistory.tip3', 'Automatic history tracking')
      ]
    },
    {
      title: t('tutorial.settings.title', 'Settings & Configuration'),
      description: t('tutorial.settings.desc', 'Customize your experience with various settings. Change language, theme, and application behavior. Configure advanced options for optimal performance.'),
      image: '/assets/learning/settings_preview.png',
      tips: [
        t('tutorial.settings.tip1', 'Multi-language support'),
        t('tutorial.settings.tip2', 'Customize application behavior'),
        t('tutorial.settings.tip3', 'Advanced configuration options')
      ]
    }
  ];

  // [HANDLER] Navigate to next page
  const handleNext = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      // Last page - complete tutorial
      handleComplete();
    }
  }, [currentPage, pages.length]);

  // [HANDLER] Navigate to previous page
  const handlePrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  // [HANDLER] Skip tutorial
  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  // [HANDLER] Complete tutorial and mark as done
  const handleComplete = useCallback(() => {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    onClose();
  }, [onClose]);

  // [HANDLER] Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  const currentPageData = pages[currentPage];
  const progress = ((currentPage + 1) / pages.length) * 100;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        {/* [HEADER] Tutorial header with progress */}
        <div className="tutorial-header">
          <div className="tutorial-progress-bar">
            <div 
              className="tutorial-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="tutorial-header-content">
            <div className="tutorial-header-left">
              <div className="tutorial-header-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <defs>
                    <linearGradient id="tutorialIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff69b4" />
                      <stop offset="50%" stopColor="#da70d6" />
                      <stop offset="100%" stopColor="#ba55d3" />
                    </linearGradient>
                  </defs>
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
              </div>
              <div className="tutorial-header-text">
                <h2 className="tutorial-title">{currentPageData.title}</h2>
                <p className="tutorial-subtitle">{t('tutorial.headerDesc', 'Learn how to use Wildflover effectively')}</p>
              </div>
            </div>
            <button 
              className="tutorial-skip-btn" 
              onClick={handleSkip}
              aria-label="Skip tutorial"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* [CONTENT] Tutorial page content */}
        <div className="tutorial-content">
          {/* [IMAGE] Feature preview image */}
          <div className="tutorial-image-container">
            <img 
              src={currentPageData.image} 
              alt={currentPageData.title}
              className="tutorial-image"
            />
          </div>

          {/* [DESCRIPTION] Page description */}
          <div className="tutorial-description">
            <p>{currentPageData.description}</p>
          </div>

          {/* [TIPS] Optional tips section */}
          {currentPageData.tips && currentPageData.tips.length > 0 && (
            <div className="tutorial-tips">
              <h3 className="tutorial-tips-title">
                {t('tutorial.tips', 'Tips')}
              </h3>
              <ul className="tutorial-tips-list">
                {currentPageData.tips.map((tip, index) => (
                  <li key={index} className="tutorial-tip-item">
                    <span className="tutorial-tip-icon"></span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* [FOOTER] Navigation controls */}
        <div className="tutorial-footer">
          <div className="tutorial-page-indicator">
            <span>{currentPage + 1}</span>
            <span>/</span>
            <span>{pages.length}</span>
          </div>
          
          <div className="tutorial-nav-buttons">
            <button
              className="tutorial-nav-btn tutorial-prev-btn"
              onClick={handlePrev}
              disabled={currentPage === 0}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              {t('tutorial.previous', 'Previous')}
            </button>
            
            <button
              className="tutorial-nav-btn tutorial-next-btn"
              onClick={handleNext}
            >
              {currentPage === pages.length - 1 
                ? t('tutorial.finish', 'Finish') 
                : t('tutorial.next', 'Next')
              }
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {currentPage === pages.length - 1 
                  ? <path d="M5 12l5 5L20 7"/>
                  : <path d="M9 18l6-6-6-6"/>
                }
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// [EXPORT] Check if tutorial should be shown
export const shouldShowTutorial = (): boolean => {
  return localStorage.getItem(TUTORIAL_COMPLETED_KEY) !== 'true';
};

// [EXPORT] Reset tutorial (for testing or user request)
export const resetTutorial = (): void => {
  localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
};

export default TutorialModal;

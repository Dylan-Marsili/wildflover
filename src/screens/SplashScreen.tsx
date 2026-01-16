/**
 * File: SplashScreen.tsx
 * Author: Wildflover
 * Description: Splash screen with optimized animations and memoized features
 * Language: TypeScript/React
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./SplashScreen.css";

// [PROPS] Component property definitions
interface SplashScreenProps {
  onComplete: () => void;
}

// [COMPONENT] Splash screen with progress animation
const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(t('splash.loading'));
  const [activeFeature, setActiveFeature] = useState(0);
  const rafIdRef = useRef<number>(0);

  // [MEMO] Feature list - memoized with i18n support
  const features = useMemo(() => [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      title: t('splash.allChampions'),
      desc: t('splash.allChampionsDesc')
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      ),
      title: t('splash.premiumSkins'),
      desc: t('splash.premiumSkinsDesc')
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      title: t('splash.favorites'),
      desc: t('splash.favoritesDesc')
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
      title: t('splash.easySetup'),
      desc: t('splash.easySetupDesc')
    }
  ], [t]);

  // [MEMO] Progress stages - memoized
  const stages = useMemo(() => [
    { progress: 25, label: t('splash.loadingChampions') },
    { progress: 50, label: t('splash.fetchingSkins') },
    { progress: 75, label: t('splash.loading') },
    { progress: 100, label: t('splash.ready') },
  ], [t]);

  // [CALLBACK] Memoized completion handler
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // [EFFECT] Progress animation with requestAnimationFrame
  useEffect(() => {
    const totalDuration = 3000;
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = (elapsed / totalDuration) * 100;
      const clampedProgress = Math.min(rawProgress, 100);

      setProgress(clampedProgress);

      if (clampedProgress < 25) {
        setStatus(stages[0].label);
        setActiveFeature(0);
      } else if (clampedProgress < 50) {
        setStatus(stages[1].label);
        setActiveFeature(1);
      } else if (clampedProgress < 75) {
        setStatus(stages[2].label);
        setActiveFeature(2);
      } else {
        setStatus(stages[3].label);
        setActiveFeature(3);
      }

      if (clampedProgress < 100) {
        rafIdRef.current = requestAnimationFrame(updateProgress);
      } else {
        setTimeout(handleComplete, 400);
      }
    };

    const startTimeout = setTimeout(() => {
      rafIdRef.current = requestAnimationFrame(updateProgress);
    }, 300);

    return () => {
      clearTimeout(startTimeout);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [stages, handleComplete]);

  // [MEMO] Hex grid elements - reduced from 12 to 8 for performance
  const hexElements = useMemo(() => 
    [...Array(8)].map((_, i) => (
      <div key={i} className="hex" style={{ animationDelay: `${i * 0.25}s` }} />
    )), []);

  return (
    <div className="splash-screen" data-tauri-drag-region>
      {/* [BG] Animated background elements */}
      <div className="splash-bg-effects" data-tauri-drag-region>
        <div className="hex-grid">{hexElements}</div>
        <div className="glow-orb orb-1" />
        <div className="glow-orb orb-2" />
        <div className="glow-orb orb-3" />
      </div>

      <div className="splash-content" data-tauri-drag-region>
        {/* [LOGO] Logo section */}
        <div className="splash-logo-section" data-tauri-drag-region>
          <div className="logo-container">
            <div className="logo-ring ring-outer" />
            <div className="logo-ring ring-inner" />
            <div className="logo-core">
              <img src="/assets/icons/icon.png" alt="Wildflover Logo" />
            </div>
          </div>
          
          <div className="splash-title-group" data-tauri-drag-region>
            <h1 className="splash-title">
              <span className="title-wild">Wild</span>
              <span className="title-flower">flover</span>
            </h1>
            <div className="splash-subtitle">
              <span className="subtitle-line" />
              <span className="subtitle-text">{t('app.subtitle')}</span>
              <span className="subtitle-line" />
            </div>
          </div>
        </div>

        {/* [FEATURES] Features grid */}
        <div className="splash-features">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`splash-feature ${index === activeFeature ? 'active' : ''} ${index < activeFeature ? 'done' : ''}`}
              style={{ animationDelay: `${0.5 + index * 0.1}s` }}
            >
              <div className="feature-icon-wrap">{feature.icon}</div>
              <div className="feature-content">
                <span className="feature-name">{feature.title}</span>
                <span className="feature-info">{feature.desc}</span>
              </div>
              {index < activeFeature && (
                <div className="feature-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
              {index === activeFeature && <div className="feature-pulse" />}
            </div>
          ))}
        </div>

        {/* [PROGRESS] Progress section */}
        <div className="splash-progress" data-tauri-drag-region>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-glow" style={{ left: `${progress}%` }} />
          </div>
          <div className="progress-details">
            <span className="progress-label">{status}</span>
            <span className="progress-value">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* [FOOTER] Footer */}
        <div className="splash-footer" data-tauri-drag-region>
          <span className="footer-text">by Wildflover</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;

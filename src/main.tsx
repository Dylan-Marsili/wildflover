/**
 * File: main.tsx
 * Author: Wildflover
 * Description: Application entry point with professional logging system
 * Language: TypeScript/React
 */

import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { logger } from "./utils/logger";
import { initializeAPI } from "./services/api";
import { getCurrentLanguage } from "./i18n";
import { customsStorage } from "./services/customsStorage";
import './i18n';

// [INIT] Print application banner
logger.printBanner();
logger.system('Application initialization started');
logger.init('Loading core modules...');
logger.init('i18n multi-language support loaded');

// [CACHE-CLEAR] Dynamic cache invalidation system
const CACHE_VERSION = '8.0';
const CACHE_PREFIX = 'wildflover_';
const VERSION_KEY = 'wildflover_cache_version';

const cacheVersion = localStorage.getItem(VERSION_KEY);
if (cacheVersion !== CACHE_VERSION) {
  // Dynamic cleanup: Remove all wildflover_ prefixed keys except version tracker
  const keysToRemove = Object.keys(localStorage).filter(
    key => key.startsWith(CACHE_PREFIX) && key !== VERSION_KEY
  );
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  localStorage.setItem(VERSION_KEY, CACHE_VERSION);
  
  logger.cache(`Cache invalidated | v${cacheVersion || 'none'} -> v${CACHE_VERSION} | ${keysToRemove.length} keys cleared`);
}

// [API-INIT] Initialize API services
initializeAPI(getCurrentLanguage()).then(() => {
  logger.success('API services initialized');
}).catch((error) => {
  console.error('[API-ERROR] Initialization failed:', error);
});

// [THUMBNAIL-REPAIR] Auto-repair missing thumbnails for marketplace mods
customsStorage.getMissingThumbnailsCount().then((missingCount) => {
  if (missingCount > 0) {
    logger.init(`Repairing ${missingCount} missing marketplace thumbnails...`);
    customsStorage.repairMissingThumbnails().then((result: { repaired: number; failed: number }) => {
      if (result.repaired > 0) {
        logger.success(`Thumbnail repair complete | ${result.repaired} repaired, ${result.failed} failed`);
      }
    }).catch((error: unknown) => {
      console.error('[THUMBNAIL-REPAIR] Error:', error);
    });
  }
}).catch((error: unknown) => {
  console.error('[THUMBNAIL-COUNT] Error:', error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);

logger.success('Application mounted successfully');

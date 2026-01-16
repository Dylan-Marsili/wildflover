/**
 * File: Toast.tsx
 * Author: Wildflover
 * Description: Global toast notification system with modern dark theme
 *              - Multiple toast types: success, error, warning, info
 *              - Auto-dismiss with progress indicator
 *              - Smooth animations and glass morphism design
 * Language: TypeScript/React
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import './Toast.css';

// [TYPE] Toast notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'rateLimit';

// [INTERFACE] Toast item structure
export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  countdown?: number;
}

// [INTERFACE] Toast context value
interface ToastContextValue {
  showToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  showRateLimitToast: (seconds: number) => void;
  hideToast: (id: string) => void;
}

// [CONTEXT] Toast context
const ToastContext = createContext<ToastContextValue | null>(null);

// [HOOK] Use toast hook
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// [COMPONENT] Toast provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // [FUNC] Generate unique ID
  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  // [FUNC] Show toast notification
  const showToast = useCallback((
    type: ToastType,
    title: string,
    message: string,
    duration: number = 4000
  ) => {
    const id = generateId();
    const toast: ToastItem = { id, type, title, message, duration };
    
    setToasts(prev => [...prev, toast]);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, [generateId]);

  // [FUNC] Show rate limit toast with countdown
  const showRateLimitToast = useCallback((seconds: number) => {
    const id = 'rate_limit_toast';
    
    // Remove existing rate limit toast
    setToasts(prev => prev.filter(t => t.id !== id));
    
    const toast: ToastItem = {
      id,
      type: 'rateLimit',
      title: 'Rate Limited',
      message: `Please wait before trying again`,
      duration: seconds * 1000,
      countdown: seconds
    };
    
    setToasts(prev => [...prev, toast]);
  }, []);

  // [FUNC] Hide specific toast
  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showRateLimitToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

// [COMPONENT] Toast container
function ToastContainer({ 
  toasts, 
  onDismiss 
}: { 
  toasts: ToastItem[]; 
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="wf-toast-container">
      {toasts.map(toast => (
        <ToastNotification 
          key={toast.id} 
          toast={toast} 
          onDismiss={() => onDismiss(toast.id)} 
        />
      ))}
    </div>
  );
}

// [COMPONENT] Individual toast notification
function ToastNotification({ 
  toast, 
  onDismiss 
}: { 
  toast: ToastItem; 
  onDismiss: () => void;
}) {
  const [countdown, setCountdown] = useState(toast.countdown || 0);
  const [isExiting, setIsExiting] = useState(false);

  // [EFFECT] Countdown timer for rate limit
  useEffect(() => {
    if (toast.type !== 'rateLimit' || !toast.countdown) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [toast.type, toast.countdown]);

  // [HANDLER] Dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  // [RENDER] Get icon based on type
  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'warning':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'rateLimit':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <div className={`wf-toast wf-toast-${toast.type} ${isExiting ? 'wf-toast-exit' : ''}`}>
      <div className="wf-toast-icon">{renderIcon()}</div>
      
      <div className="wf-toast-content">
        <span className="wf-toast-title">{toast.title}</span>
        <span className="wf-toast-message">
          {toast.type === 'rateLimit' ? (
            <>
              {toast.message}
              <span className="wf-toast-countdown">{countdown}s</span>
            </>
          ) : (
            toast.message
          )}
        </span>
      </div>

      <button className="wf-toast-close" onClick={handleDismiss}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {toast.duration && toast.duration > 0 && (
        <div 
          className="wf-toast-progress" 
          style={{ animationDuration: `${toast.duration}ms` }} 
        />
      )}
    </div>
  );
}

export default ToastProvider;

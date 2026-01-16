/**
 * File: network.ts
 * Author: Wildflover
 * Description: Discord API network utilities with retry mechanism
 *              - Automatic retry on network failures
 *              - Exponential backoff with jitter
 *              - Request timeout support
 *              - Error classification
 * Language: TypeScript
 */

// [CONSTANTS] Network retry configuration - Optimized for faster recovery
export const NETWORK_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 800,      // Reduced from 1000ms for faster retry
  MAX_DELAY_MS: 8000,      // Reduced from 10000ms
  TIMEOUT_MS: 12000,       // Reduced from 15000ms to match backend
  DNS_TIMEOUT_MS: 5000,    // DNS resolution timeout
} as const;

// [TYPE] Network error classification
export type NetworkErrorType = 
  | 'timeout' 
  | 'connection' 
  | 'server' 
  | 'rate_limit' 
  | 'auth' 
  | 'unknown';

// [INTERFACE] Fetch result with response and parsed data
export interface FetchResult<T> {
  response: Response;
  data?: T;
}

// [CLASS] Network utility service for Discord API calls
export class NetworkService {
  private rateLimitCallback?: (retryAfter?: number) => void;

  constructor(onRateLimit?: (retryAfter?: number) => void) {
    this.rateLimitCallback = onRateLimit;
  }

  // [METHOD] Classify network error type for appropriate handling
  public classifyError(error: unknown, response?: Response): NetworkErrorType {
    if (response) {
      if (response.status === 401) return 'auth';
      if (response.status === 429) return 'rate_limit';
      if (response.status >= 500) return 'server';
    }

    if (error instanceof TypeError) {
      return 'connection';
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'timeout';
    }

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return 'timeout';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || 
        errorMessage.includes('connection') || errorMessage.includes('offline')) {
      return 'connection';
    }

    return 'unknown';
  }


  // [METHOD] Calculate retry delay with exponential backoff and jitter
  private calculateDelay(attempt: number): number {
    const baseDelay = NETWORK_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(baseDelay + jitter, NETWORK_CONFIG.MAX_DELAY_MS);
  }

  // [METHOD] Sleep utility for retry delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // [METHOD] Fetch with timeout support
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeoutMs: number = NETWORK_CONFIG.TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // [METHOD] Execute fetch with automatic retry on network errors
  public async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    parseJson: boolean = true
  ): Promise<FetchResult<T>> {
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < NETWORK_CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(`[DISCORD-NETWORK] Attempt ${attempt + 1}/${NETWORK_CONFIG.MAX_RETRIES} for ${url}`);
        
        const response = await this.fetchWithTimeout(url, options);
        lastResponse = response;

        if (response.ok) {
          console.log(`[DISCORD-NETWORK] Request successful on attempt ${attempt + 1}`);
          if (parseJson) {
            const data = await response.json() as T;
            return { response, data };
          }
          return { response };
        }

        const errorType = this.classifyError(null, response);

        // Auth errors - return for caller to handle
        if (errorType === 'auth') {
          console.log('[DISCORD-NETWORK] Auth error detected');
          return { response };
        }

        // Rate limit - notify and throw
        if (errorType === 'rate_limit') {
          const retryAfter = response.headers.get('Retry-After');
          console.log(`[DISCORD-NETWORK] Rate limited, Retry-After: ${retryAfter}`);
          this.rateLimitCallback?.(retryAfter ? parseInt(retryAfter, 10) : undefined);
          throw new Error('Rate limited by Discord API');
        }

        // Server errors - retry with backoff
        if (errorType === 'server' && attempt < NETWORK_CONFIG.MAX_RETRIES - 1) {
          const delay = this.calculateDelay(attempt);
          console.log(`[DISCORD-NETWORK] Server error (${response.status}), retrying in ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorType = this.classifyError(error, lastResponse ?? undefined);

        console.log(`[DISCORD-NETWORK] Error on attempt ${attempt + 1}: ${errorType} - ${lastError.message}`);

        if (errorType === 'rate_limit') {
          throw lastError;
        }

        // Retry on retryable errors
        const isRetryable = errorType === 'connection' || errorType === 'timeout' || errorType === 'server';
        if (isRetryable && attempt < NETWORK_CONFIG.MAX_RETRIES - 1) {
          const delay = this.calculateDelay(attempt);
          console.log(`[DISCORD-NETWORK] Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        if (attempt === NETWORK_CONFIG.MAX_RETRIES - 1) {
          console.error(`[DISCORD-NETWORK] Max retries (${NETWORK_CONFIG.MAX_RETRIES}) exceeded`);
        }
      }
    }

    throw lastError || new Error('Network request failed after retries');
  }
}

// [EXPORT] Default network service instance
export const networkService = new NetworkService();

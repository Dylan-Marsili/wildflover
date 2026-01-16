/**
 * File: events.ts
 * Author: Wildflover
 * Description: Event emitter for Discord service notifications
 *              - Rate limit events for toast notifications
 *              - Decouples service layer from React components
 * Language: TypeScript
 */

// [TYPE] Event types
export type DiscordEventType = 'rateLimit' | 'authError' | 'networkError';

// [INTERFACE] Rate limit event payload
export interface RateLimitEvent {
  seconds: number;
  message?: string;
}

// [INTERFACE] Error event payload
export interface ErrorEvent {
  code: string;
  message: string;
}

// [TYPE] Event payloads union
export type DiscordEventPayload = RateLimitEvent | ErrorEvent;

// [TYPE] Event listener function
type EventListener<T = DiscordEventPayload> = (payload: T) => void;

// [CLASS] Discord event emitter singleton
class DiscordEventEmitter {
  private listeners: Map<DiscordEventType, Set<EventListener>> = new Map();

  // [METHOD] Subscribe to event
  public on<T extends DiscordEventPayload>(
    event: DiscordEventType, 
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(listener as EventListener);
    console.log(`[DISCORD-EVENTS] Listener added for: ${event}`);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener as EventListener);
      console.log(`[DISCORD-EVENTS] Listener removed for: ${event}`);
    };
  }

  // [METHOD] Emit event to all listeners
  public emit<T extends DiscordEventPayload>(event: DiscordEventType, payload: T): void {
    const eventListeners = this.listeners.get(event);
    
    if (!eventListeners || eventListeners.size === 0) {
      console.log(`[DISCORD-EVENTS] No listeners for: ${event}`);
      return;
    }

    console.log(`[DISCORD-EVENTS] Emitting ${event}:`, payload);
    eventListeners.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[DISCORD-EVENTS] Listener error for ${event}:`, error);
      }
    });
  }

  // [METHOD] Emit rate limit event
  public emitRateLimit(seconds: number, message?: string): void {
    this.emit<RateLimitEvent>('rateLimit', { seconds, message });
  }

  // [METHOD] Emit auth error event
  public emitAuthError(code: string, message: string): void {
    this.emit<ErrorEvent>('authError', { code, message });
  }

  // [METHOD] Emit network error event
  public emitNetworkError(code: string, message: string): void {
    this.emit<ErrorEvent>('networkError', { code, message });
  }

  // [METHOD] Remove all listeners
  public removeAllListeners(): void {
    this.listeners.clear();
    console.log('[DISCORD-EVENTS] All listeners removed');
  }
}

// [EXPORT] Singleton instance
export const discordEvents = new DiscordEventEmitter();
export default discordEvents;

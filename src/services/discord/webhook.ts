/**
 * File: webhook.ts
 * Author: Wildflover
 * Description: Discord webhook notification service
 *              - Login success notifications via Rust backend
 * Language: TypeScript
 */

import { invoke } from '@tauri-apps/api/core';
import type { DiscordUser } from '../../types/discord';

// [INTERFACE] Webhook result from Rust backend
interface WebhookResult {
  success: boolean;
  message: string;
}

// [INTERFACE] User info for webhook
interface WebhookUserInfo {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

// [CLASS] Webhook notification service
class WebhookService {
  // [METHOD] Send login success notification
  public async sendLoginNotification(user: DiscordUser): Promise<boolean> {
    try {
      const userInfo: WebhookUserInfo = {
        id: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
      };

      const result = await invoke<WebhookResult>('send_login_webhook', { user: userInfo });
      
      if (result.success) {
        console.log('[WEBHOOK] Login notification sent');
      } else {
        console.warn('[WEBHOOK] Failed to send notification:', result.message);
      }
      
      return result.success;
    } catch (error) {
      console.error('[WEBHOOK] Error sending notification:', error);
      return false;
    }
  }

  // [METHOD] Send logout notification
  public async sendLogoutNotification(user: DiscordUser): Promise<boolean> {
    try {
      const userInfo: WebhookUserInfo = {
        id: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
      };

      const result = await invoke<WebhookResult>('send_logout_webhook', { user: userInfo });
      
      if (result.success) {
        console.log('[WEBHOOK] Logout notification sent');
      } else {
        console.warn('[WEBHOOK] Failed to send logout notification:', result.message);
      }
      
      return result.success;
    } catch (error) {
      console.error('[WEBHOOK] Error sending logout notification:', error);
      return false;
    }
  }
}

// [EXPORT] Singleton instance
export const webhookService = new WebhookService();
export default webhookService;

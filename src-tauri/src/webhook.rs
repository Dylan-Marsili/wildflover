//! File: webhook.rs
//! Author: Wildflover
//! Description: Discord webhook notification service
//!              - Login success notifications
//!              - User info embed messages
//! Language: Rust

use serde::{Deserialize, Serialize};

// [CONSTANTS] Discord webhook URL
// IMPORTANT: Replace with your own Discord webhook URL
// Create one at: Discord Server Settings > Integrations > Webhooks
const LOGIN_WEBHOOK_URL: &str = "YOUR_DISCORD_WEBHOOK_URL";

// [STRUCT] Webhook embed field
#[derive(Debug, Serialize)]
struct EmbedField {
    name: String,
    value: String,
    inline: bool,
}

// [STRUCT] Webhook embed thumbnail
#[derive(Debug, Serialize)]
struct EmbedThumbnail {
    url: String,
}

// [STRUCT] Webhook embed footer
#[derive(Debug, Serialize)]
struct EmbedFooter {
    text: String,
}

// [STRUCT] Webhook embed
#[derive(Debug, Serialize)]
struct WebhookEmbed {
    title: String,
    description: String,
    color: u32,
    thumbnail: EmbedThumbnail,
    fields: Vec<EmbedField>,
    footer: EmbedFooter,
    timestamp: String,
}

// [STRUCT] Webhook payload
#[derive(Debug, Serialize)]
struct WebhookPayload {
    embeds: Vec<WebhookEmbed>,
}

// [STRUCT] User info from frontend
#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub global_name: Option<String>,
    pub avatar: Option<String>,
}

// [STRUCT] Webhook result
#[derive(Debug, Serialize)]
pub struct WebhookResult {
    pub success: bool,
    pub message: String,
}

// [FUNC] Build avatar URL with cache-busting timestamp
fn build_avatar_url(user_id: &str, avatar_hash: Option<&str>) -> String {
    let cache_buster = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() / 300;
    
    match avatar_hash {
        Some(hash) => {
            let ext = if hash.starts_with("a_") { "gif" } else { "png" };
            format!("https://cdn.discordapp.com/avatars/{}/{}.{}?size=256&_={}", user_id, hash, ext, cache_buster)
        }
        None => {
            let default_index = user_id.parse::<u64>().unwrap_or(0) % 5;
            format!("https://cdn.discordapp.com/embed/avatars/{}.png", default_index)
        }
    }
}

// [COMMAND] Send login success webhook
#[tauri::command]
pub async fn send_login_webhook(user: UserInfo) -> WebhookResult {
    println!("[WEBHOOK] Sending login notification for user: {}", user.username);
    
    let avatar_url = build_avatar_url(&user.id, user.avatar.as_deref());
    let display_name = user.global_name.clone().unwrap_or_else(|| user.username.clone());
    let timestamp = chrono::Utc::now().to_rfc3339();
    
    let embed = WebhookEmbed {
        title: "New Login".to_string(),
        description: format!("**{}** logged in successfully", display_name),
        color: 0x57F287,
        thumbnail: EmbedThumbnail { url: avatar_url.clone() },
        fields: vec![
            EmbedField {
                name: "Display Name".to_string(),
                value: display_name,
                inline: true,
            },
            EmbedField {
                name: "Username".to_string(),
                value: user.username.clone(),
                inline: true,
            },
            EmbedField {
                name: "User ID".to_string(),
                value: format!("`{}`", user.id),
                inline: false,
            },
        ],
        footer: EmbedFooter {
            text: "Wildflover Login System".to_string(),
        },
        timestamp,
    };

    let payload = WebhookPayload {
        embeds: vec![embed],
    };

    let client = reqwest::Client::new();
    
    match client
        .post(LOGIN_WEBHOOK_URL)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                println!("[WEBHOOK] Login notification sent successfully");
                WebhookResult {
                    success: true,
                    message: "Notification sent".to_string(),
                }
            } else {
                let status = response.status();
                println!("[WEBHOOK] Failed to send notification: {}", status);
                WebhookResult {
                    success: false,
                    message: format!("Failed: {}", status),
                }
            }
        }
        Err(e) => {
            println!("[WEBHOOK] Network error: {}", e);
            WebhookResult {
                success: false,
                message: format!("Network error: {}", e),
            }
        }
    }
}

// [COMMAND] Send logout webhook
#[tauri::command]
pub async fn send_logout_webhook(user: UserInfo) -> WebhookResult {
    println!("[WEBHOOK] Sending logout notification for user: {}", user.username);
    
    let avatar_url = build_avatar_url(&user.id, user.avatar.as_deref());
    let display_name = user.global_name.clone().unwrap_or_else(|| user.username.clone());
    let timestamp = chrono::Utc::now().to_rfc3339();
    
    let embed = WebhookEmbed {
        title: "User Logout".to_string(),
        description: format!("**{}** logged out", display_name),
        color: 0xED4245,
        thumbnail: EmbedThumbnail { url: avatar_url.clone() },
        fields: vec![
            EmbedField {
                name: "Display Name".to_string(),
                value: display_name,
                inline: true,
            },
            EmbedField {
                name: "Username".to_string(),
                value: user.username.clone(),
                inline: true,
            },
            EmbedField {
                name: "User ID".to_string(),
                value: format!("`{}`", user.id),
                inline: false,
            },
        ],
        footer: EmbedFooter {
            text: "Wildflover Login System".to_string(),
        },
        timestamp,
    };

    let payload = WebhookPayload {
        embeds: vec![embed],
    };

    let client = reqwest::Client::new();
    
    match client
        .post(LOGIN_WEBHOOK_URL)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                println!("[WEBHOOK] Logout notification sent successfully");
                WebhookResult {
                    success: true,
                    message: "Notification sent".to_string(),
                }
            } else {
                let status = response.status();
                println!("[WEBHOOK] Failed to send logout notification: {}", status);
                WebhookResult {
                    success: false,
                    message: format!("Failed: {}", status),
                }
            }
        }
        Err(e) => {
            println!("[WEBHOOK] Network error: {}", e);
            WebhookResult {
                success: false,
                message: format!("Network error: {}", e),
            }
        }
    }
}

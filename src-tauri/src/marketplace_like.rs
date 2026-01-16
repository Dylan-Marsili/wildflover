//! File: marketplace_like.rs
//! Author: Wildflover
//! Description: Marketplace like/unlike functionality for mod engagement tracking
//!              - Like/Unlike mods via GitHub API
//!              - Update likeCount and likedBy in index.json
//!              - Retry mechanism for concurrent updates (SHA conflict handling)
//!              - Queue-based sequential processing for atomic commits
//! Language: Rust

use serde::{Deserialize, Serialize};
use reqwest::Client;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::marketplace::get_token;
use std::sync::Arc;
use tokio::sync::Mutex;

// [STRUCT] Like operation result
#[derive(Serialize)]
pub struct LikeResult {
    pub success: bool,
    pub error: Option<String>,
}

// [STRUCT] User info for like tracking
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub discord_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar: Option<String>,
}

// [CONST] Retry configuration
const MAX_RETRIES: u32 = 5;
const RETRY_DELAY_MS: u64 = 600;

// [STATIC] Global async mutex for sequential like updates
static LIKE_MUTEX: std::sync::OnceLock<Arc<Mutex<()>>> = std::sync::OnceLock::new();

fn get_like_mutex() -> Arc<Mutex<()>> {
    LIKE_MUTEX.get_or_init(|| Arc::new(Mutex::new(()))).clone()
}

// [COMMAND] Like/Unlike mod in marketplace (updates GitHub index.json)
#[tauri::command]
pub async fn like_marketplace_mod(
    mod_id: String,
    like: bool,
    user_info: Option<UserInfo>,
    github_owner: String,
    github_repo: String,
) -> LikeResult {
    println!("[MARKETPLACE-LIKE] Queued {} for mod: {}", if like { "like" } else { "unlike" }, mod_id);
    
    // Acquire async lock to serialize all like updates
    let mutex = get_like_mutex();
    let _lock = mutex.lock().await;
    
    println!("[MARKETPLACE-LIKE] Processing: {}", mod_id);
    
    let mut last_error = String::new();
    
    // Retry loop for handling SHA conflicts
    for attempt in 1..=MAX_RETRIES {
        match try_like_mod(&mod_id, like, &user_info, &github_owner, &github_repo).await {
            Ok(()) => {
                println!("[MARKETPLACE-LIKE] Success on attempt {}: {}", attempt, mod_id);
                return LikeResult {
                    success: true,
                    error: None,
                };
            }
            Err(e) => {
                last_error = e.clone();
                println!("[MARKETPLACE-LIKE] Attempt {} failed: {}", attempt, e);
                
                // Check if it's a SHA conflict (409) - retry with exponential backoff
                if e.contains("409") || e.contains("conflict") || e.contains("Update is not a fast forward") {
                    if attempt < MAX_RETRIES {
                        let delay = RETRY_DELAY_MS * (attempt as u64);
                        println!("[MARKETPLACE-LIKE] SHA conflict detected, retry in {}ms...", delay);
                        tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                        continue;
                    }
                } else {
                    // Non-retryable error - break immediately
                    break;
                }
            }
        }
    }
    
    LikeResult {
        success: false,
        error: Some(format!("Failed after {} attempts: {}", MAX_RETRIES, last_error)),
    }
}

// [FUNCTION] Internal function to attempt like/unlike operation
async fn try_like_mod(
    mod_id: &str,
    like: bool,
    user_info: &Option<UserInfo>,
    github_owner: &str,
    github_repo: &str,
) -> Result<(), String> {
    let github_token = get_token();
    let api_base = format!("https://api.github.com/repos/{}/{}", github_owner, github_repo);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    // [STEP-1] Fetch current index.json with fresh SHA
    let index_api_url = format!("{}/contents/index.json", api_base);
    
    let index_response = client
        .get(&index_api_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch index.json: {}", e))?;
    
    if !index_response.status().is_success() {
        return Err(format!("GitHub API error: {}", index_response.status()));
    }
    
    let index_data: serde_json::Value = index_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Get current SHA for atomic update
    let current_sha = index_data["sha"].as_str().unwrap_or("").to_string();
    
    // Decode content from base64
    let content_base64 = index_data["content"].as_str().unwrap_or("");
    let content_clean = content_base64.replace('\n', "").replace('\r', "");
    
    let content_bytes = BASE64
        .decode(&content_clean)
        .map_err(|e| format!("Failed to decode content: {}", e))?;
    
    let content_str = String::from_utf8_lossy(&content_bytes);
    
    let mut index_json: serde_json::Value = serde_json::from_str(&content_str)
        .map_err(|e| format!("Failed to parse index.json: {}", e))?;
    
    // [STEP-2] Find and update mod likedBy array, then sync likeCount
    let mut mod_found = false;
    if let Some(mods_array) = index_json["mods"].as_array_mut() {
        for mod_entry in mods_array.iter_mut() {
            if mod_entry["id"].as_str() == Some(mod_id) {
                // Update likedBy array first
                if let Some(ref user) = user_info {
                    // Ensure likedBy array exists
                    if mod_entry.get("likedBy").is_none() || !mod_entry["likedBy"].is_array() {
                        mod_entry["likedBy"] = serde_json::json!([]);
                    }
                    
                    let liked_by = mod_entry.get_mut("likedBy")
                        .and_then(|v| v.as_array_mut())
                        .unwrap();
                    
                    if like {
                        // Check if user already liked - prevent duplicate
                        let exists = liked_by.iter().any(|l| {
                            l["discordId"].as_str() == Some(&user.discord_id)
                        });
                        
                        if !exists {
                            // Add user to likedBy
                            let new_liker = serde_json::json!({
                                "discordId": user.discord_id,
                                "username": user.username,
                                "displayName": user.display_name,
                                "avatar": user.avatar,
                                "likedAt": chrono::Utc::now().to_rfc3339()
                            });
                            liked_by.push(new_liker);
                        }
                    } else {
                        // Remove user from likedBy
                        liked_by.retain(|l| {
                            l["discordId"].as_str() != Some(&user.discord_id)
                        });
                    }
                    
                    // Sync likeCount with actual likedBy array length
                    let actual_count = liked_by.len() as i64;
                    mod_entry["likeCount"] = serde_json::json!(actual_count);
                } else {
                    // No user info - cannot track who liked, skip operation
                    println!("[MARKETPLACE-LIKE] Warning: No user info provided, skipping like operation");
                    return Err("User info required for like operation".to_string());
                }
                
                mod_found = true;
                break;
            }
        }
    }
    
    if !mod_found {
        return Err(format!("Mod not found: {}", mod_id));
    }
    
    // [STEP-3] Update index.json on GitHub with atomic commit
    let updated_content = serde_json::to_string_pretty(&index_json).unwrap();
    let updated_base64 = BASE64.encode(updated_content.as_bytes());
    
    let update_response = client
        .put(&index_api_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({
            "message": format!("[MARKETPLACE] {}: {}", if like { "Like" } else { "Unlike" }, mod_id),
            "content": updated_base64,
            "sha": current_sha
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to update index.json: {}", e))?;
    
    if !update_response.status().is_success() {
        let status = update_response.status();
        let body = update_response.text().await.unwrap_or_default();
        return Err(format!("GitHub update failed: {} - {}", status, body));
    }
    
    Ok(())
}

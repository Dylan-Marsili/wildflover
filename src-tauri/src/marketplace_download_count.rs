//! File: marketplace_download_count.rs
//! Author: Wildflover
//! Description: Marketplace download count increment functionality
//!              - Increment downloadCount in index.json via GitHub API
//!              - Retry mechanism for concurrent updates (SHA conflict handling)
//!              - Queue-based sequential processing for atomic commits
//! Language: Rust

use serde::Serialize;
use reqwest::Client;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::marketplace::get_token;
use std::sync::Arc;
use tokio::sync::Mutex;

// [STRUCT] Download count increment result
#[derive(Serialize)]
pub struct IncrementResult {
    pub success: bool,
    pub new_count: Option<i64>,
    pub error: Option<String>,
}

// [CONST] Retry configuration
const MAX_RETRIES: u32 = 5;
const RETRY_DELAY_MS: u64 = 600;

// [STATIC] Global async mutex for sequential updates
static UPDATE_MUTEX: std::sync::OnceLock<Arc<Mutex<()>>> = std::sync::OnceLock::new();

fn get_update_mutex() -> Arc<Mutex<()>> {
    UPDATE_MUTEX.get_or_init(|| Arc::new(Mutex::new(()))).clone()
}

// [COMMAND] Increment download count for mod in marketplace
#[tauri::command]
pub async fn increment_download_count(
    mod_id: String,
    github_owner: String,
    github_repo: String,
) -> IncrementResult {
    println!("[MARKETPLACE-DOWNLOAD-COUNT] Queued increment for mod: {}", mod_id);
    
    // Acquire async lock to serialize all download count updates
    let mutex = get_update_mutex();
    let _lock = mutex.lock().await;
    
    println!("[MARKETPLACE-DOWNLOAD-COUNT] Processing: {}", mod_id);
    
    let mut last_error = String::new();
    
    // Retry loop for handling SHA conflicts
    for attempt in 1..=MAX_RETRIES {
        match try_increment_download_count(&mod_id, &github_owner, &github_repo).await {
            Ok(new_count) => {
                println!("[MARKETPLACE-DOWNLOAD-COUNT] Success on attempt {}: {} -> {}", attempt, mod_id, new_count);
                return IncrementResult {
                    success: true,
                    new_count: Some(new_count),
                    error: None,
                };
            }
            Err(e) => {
                last_error = e.clone();
                println!("[MARKETPLACE-DOWNLOAD-COUNT] Attempt {} failed: {}", attempt, e);
                
                // Check if it's a SHA conflict (409) - retry with exponential backoff
                if e.contains("409") || e.contains("conflict") || e.contains("Update is not a fast forward") {
                    if attempt < MAX_RETRIES {
                        let delay = RETRY_DELAY_MS * (attempt as u64);
                        println!("[MARKETPLACE-DOWNLOAD-COUNT] SHA conflict detected, retry in {}ms...", delay);
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
    
    IncrementResult {
        success: false,
        new_count: None,
        error: Some(format!("Failed after {} attempts: {}", MAX_RETRIES, last_error)),
    }
}

// [FUNCTION] Internal function to attempt download count increment
async fn try_increment_download_count(
    mod_id: &str,
    github_owner: &str,
    github_repo: &str,
) -> Result<i64, String> {
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
    
    // [STEP-2] Find and update mod downloadCount
    let mut mod_found = false;
    let mut new_count: i64 = 0;
    
    if let Some(mods_array) = index_json["mods"].as_array_mut() {
        for mod_entry in mods_array.iter_mut() {
            if mod_entry["id"].as_str() == Some(mod_id) {
                let current_count = mod_entry["downloadCount"].as_i64().unwrap_or(0);
                new_count = current_count + 1;
                mod_entry["downloadCount"] = serde_json::json!(new_count);
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
            "message": format!("[MARKETPLACE] Download count: {} (+1)", mod_id),
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
    
    Ok(new_count)
}

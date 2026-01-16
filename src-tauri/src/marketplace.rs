//! File: marketplace.rs
//! Author: Wildflover
//! Description: Marketplace backend module for GitHub-based mod distribution
//!              - Download mods from GitHub repository
//!              - Catalog fetching via GitHub API
//!              - Local cache management
//! Language: Rust

use serde::Serialize;
use std::path::PathBuf;
use reqwest::Client;
use tokio::fs;

// [CONST] GitHub Personal Access Token
// IMPORTANT: Replace with your own GitHub PAT
// Create one at: https://github.com/settings/tokens
// Required scopes: repo (for private repos) or public_repo (for public repos)
const GITHUB_TOKEN: &str = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN";

// [FUNC] Get GitHub token (public for other modules)
pub fn get_token() -> String {
    GITHUB_TOKEN.to_string()
}

// [STRUCT] Download result
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub success: bool,
    pub local_path: Option<String>,
    pub error: Option<String>,
}

// [STRUCT] Catalog fetch result
#[derive(Serialize)]
pub struct CatalogFetchResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

// [FUNC] Get marketplace cache directory
fn get_marketplace_cache_dir() -> PathBuf {
    let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    app_data.join("Wildflover").join("marketplace")
}

// [COMMAND] Fetch marketplace catalog via GitHub Contents API
#[tauri::command]
pub async fn fetch_marketplace_catalog(catalog_url: String) -> CatalogFetchResult {
    let parts: Vec<&str> = catalog_url.split('/').collect();
    let (owner, repo) = if parts.len() >= 5 && parts[2] == "raw.githubusercontent.com" {
        (parts[3], parts[4])
    } else {
        return CatalogFetchResult {
            success: false,
            data: None,
            error: Some("Invalid catalog URL format".to_string()),
        };
    };
    
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/contents/index.json",
        owner, repo
    );
    
    println!("[MARKETPLACE-CATALOG] Fetching via GitHub API: {}", api_url);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    let token = get_token();
    
    match client
        .get(&api_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github.raw+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
    {
        Ok(response) => {
            if !response.status().is_success() {
                let status = response.status();
                return CatalogFetchResult {
                    success: false,
                    data: None,
                    error: Some(format!("GitHub API error: HTTP {}", status)),
                };
            }
            
            match response.text().await {
                Ok(text) => {
                    println!("[MARKETPLACE-CATALOG] Fetched {} bytes", text.len());
                    CatalogFetchResult {
                        success: true,
                        data: Some(text),
                        error: None,
                    }
                }
                Err(e) => CatalogFetchResult {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to read response: {}", e)),
                },
            }
        }
        Err(e) => CatalogFetchResult {
            success: false,
            data: None,
            error: Some(format!("Request failed: {}", e)),
        },
    }
}


// [COMMAND] Download mod from marketplace via GitHub API
#[tauri::command]
pub async fn download_marketplace_mod(
    mod_id: String,
    download_url: String,
    mod_name: String,
) -> DownloadResult {
    println!("[MARKETPLACE-DOWNLOAD] Starting download: {} ({})", mod_name, mod_id);
    
    let cache_dir = get_marketplace_cache_dir();
    println!("[MARKETPLACE-DOWNLOAD] Cache directory: {:?}", cache_dir);
    
    let mod_dir = cache_dir.join(&mod_id);
    let mod_file = mod_dir.join("mod.fantome");
    
    println!("[MARKETPLACE-DOWNLOAD] Target file path: {:?}", mod_file);
    println!("[MARKETPLACE-DOWNLOAD] Path as string: {}", mod_file.to_string_lossy());
    
    // Check if already cached
    if mod_file.exists() {
        println!("[MARKETPLACE-DOWNLOAD] Cache hit: {}", mod_id);
        let path_str = mod_file.to_string_lossy().to_string();
        println!("[MARKETPLACE-DOWNLOAD] Returning cached path: {}", path_str);
        return DownloadResult {
            success: true,
            local_path: Some(path_str),
            error: None,
        };
    }
    
    // Create cache directory
    if let Err(e) = fs::create_dir_all(&mod_dir).await {
        return DownloadResult {
            success: false,
            local_path: None,
            error: Some(format!("Failed to create cache directory: {}", e)),
        };
    }
    
    // Convert raw URL to API URL
    let api_url = if download_url.contains("raw.githubusercontent.com") {
        let parts: Vec<&str> = download_url.split('/').collect();
        if parts.len() >= 7 {
            let owner = parts[3];
            let repo = parts[4];
            format!(
                "https://api.github.com/repos/{}/{}/contents/mods/{}/mod.fantome",
                owner, repo, mod_id
            )
        } else {
            download_url.clone()
        }
    } else {
        download_url.clone()
    };
    
    println!("[MARKETPLACE-DOWNLOAD] Using API URL: {}", api_url);
    
    let github_token = get_token();
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    match client
        .get(&api_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github.raw+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            println!("[MARKETPLACE-DOWNLOAD] Response status: {}", status);
            
            if !status.is_success() {
                let body = response.text().await.unwrap_or_default();
                return DownloadResult {
                    success: false,
                    local_path: None,
                    error: Some(format!("HTTP {}: {}", status, body)),
                };
            }
            
            match response.bytes().await {
                Ok(bytes) => {
                    println!("[MARKETPLACE-DOWNLOAD] Downloaded {} bytes", bytes.len());
                    
                    if bytes.len() < 100 {
                        return DownloadResult {
                            success: false,
                            local_path: None,
                            error: Some("Downloaded file too small".to_string()),
                        };
                    }
                    
                    if let Err(e) = fs::write(&mod_file, &bytes).await {
                        return DownloadResult {
                            success: false,
                            local_path: None,
                            error: Some(format!("Failed to write file: {}", e)),
                        };
                    }
                    
                    println!("[MARKETPLACE-DOWNLOAD] Saved to: {:?}", mod_file);
                    
                    DownloadResult {
                        success: true,
                        local_path: Some(mod_file.to_string_lossy().to_string()),
                        error: None,
                    }
                }
                Err(e) => DownloadResult {
                    success: false,
                    local_path: None,
                    error: Some(format!("Failed to read response: {}", e)),
                },
            }
        }
        Err(e) => DownloadResult {
            success: false,
            local_path: None,
            error: Some(format!("Download failed: {}", e)),
        },
    }
}

// [COMMAND] Clear marketplace cache
#[tauri::command]
pub async fn clear_marketplace_cache() -> bool {
    let cache_dir = get_marketplace_cache_dir();
    
    if cache_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&cache_dir) {
            println!("[MARKETPLACE-CACHE] Failed to clear: {}", e);
            return false;
        }
    }
    
    println!("[MARKETPLACE-CACHE] Cache cleared successfully");
    true
}

// [COMMAND] Delete single mod from marketplace cache
#[tauri::command]
pub async fn delete_marketplace_mod_cache(mod_id: String) -> bool {
    let cache_dir = get_marketplace_cache_dir();
    let mod_dir = cache_dir.join(&mod_id);
    
    if mod_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&mod_dir) {
            println!("[MARKETPLACE-CACHE] Failed to delete mod cache {}: {}", mod_id, e);
            return false;
        }
        println!("[MARKETPLACE-CACHE] Deleted mod cache: {}", mod_id);
        return true;
    }
    
    println!("[MARKETPLACE-CACHE] Mod cache not found: {}", mod_id);
    false
}

// [STRUCT] Preview fetch result
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFetchResult {
    pub success: bool,
    pub data_url: Option<String>,
    pub error: Option<String>,
}

// [COMMAND] Fetch mod preview image via GitHub API (bypasses CDN cache)
#[tauri::command]
pub async fn fetch_mod_preview(
    mod_id: String,
    github_owner: String,
    github_repo: String,
) -> PreviewFetchResult {
    let api_url = format!(
        "https://api.github.com/repos/{}/{}/contents/mods/{}/preview.jpg",
        github_owner, github_repo, mod_id
    );
    
    println!("[MARKETPLACE-PREVIEW] Fetching: {}", mod_id);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    let token = get_token();
    
    match client
        .get(&api_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github.raw+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
    {
        Ok(response) => {
            if !response.status().is_success() {
                let status = response.status();
                return PreviewFetchResult {
                    success: false,
                    data_url: None,
                    error: Some(format!("HTTP {}", status)),
                };
            }
            
            match response.bytes().await {
                Ok(bytes) => {
                    // Convert to base64 data URL
                    use base64::Engine;
                    let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    let data_url = format!("data:image/jpeg;base64,{}", base64_str);
                    
                    println!("[MARKETPLACE-PREVIEW] Fetched {} bytes for {}", bytes.len(), mod_id);
                    
                    PreviewFetchResult {
                        success: true,
                        data_url: Some(data_url),
                        error: None,
                    }
                }
                Err(e) => PreviewFetchResult {
                    success: false,
                    data_url: None,
                    error: Some(format!("Failed to read response: {}", e)),
                },
            }
        }
        Err(e) => PreviewFetchResult {
            success: false,
            data_url: None,
            error: Some(format!("Request failed: {}", e)),
        },
    }
}

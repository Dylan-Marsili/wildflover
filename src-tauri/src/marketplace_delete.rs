//! File: marketplace_delete.rs
//! Author: Wildflover
//! Description: GitHub mod deletion operations for marketplace
//!              - Delete mod files from repository
//!              - Update index.json after deletion
//!              - Atomic commit for all changes
//! Language: Rust

use reqwest::Client;
use serde::Serialize;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::marketplace_catalog::{
    GitHubBlobResponse, GitHubTreeResponse, GitHubCommitResponse, GitHubRefResponse,
};

// [STRUCT] Delete result
#[derive(Serialize)]
pub struct DeleteResult {
    pub success: bool,
    pub error: Option<String>,
}

// [FUNC] Get marketplace token (imported from parent)
fn get_marketplace_token() -> String {
    crate::marketplace::get_token()
}

// [COMMAND] Delete mod from GitHub marketplace (admin only)
#[tauri::command]
pub async fn delete_marketplace_mod(
    mod_id: String,
    github_owner: String,
    github_repo: String,
) -> DeleteResult {
    println!("[MARKETPLACE-DELETE] Starting delete: {}", mod_id);
    
    let github_token = get_marketplace_token();
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    let api_base = format!("https://api.github.com/repos/{}/{}", github_owner, github_repo);
    
    // [STEP-1] Get current branch SHA
    println!("[MARKETPLACE-DELETE] Getting current branch SHA...");
    let ref_response = match client
        .get(format!("{}/git/ref/heads/main", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return DeleteResult {
                    success: false,
                    error: Some("Failed to get branch reference".to_string()),
                };
            }
            resp.json::<GitHubRefResponse>().await.unwrap()
        }
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to get branch ref: {}", e)),
            };
        }
    };
    
    let base_sha = ref_response.object.sha;
    
    // [STEP-2] Fetch current index.json via API
    println!("[MARKETPLACE-DELETE] Fetching current index.json...");
    let index_url = format!(
        "https://api.github.com/repos/{}/{}/contents/index.json",
        github_owner, github_repo
    );
    
    let index_response = match client
        .get(&index_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github.raw+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return DeleteResult {
                    success: false,
                    error: Some("Failed to fetch index.json".to_string()),
                };
            }
            resp.text().await.unwrap_or_default()
        }
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to fetch index.json: {}", e)),
            };
        }
    };
    
    // [STEP-3] Parse and update index.json - remove mod entry
    let mut index_json: serde_json::Value = match serde_json::from_str(&index_response) {
        Ok(v) => v,
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to parse index.json: {}", e)),
            };
        }
    };
    
    if let Some(mods_array) = index_json["mods"].as_array_mut() {
        let original_len = mods_array.len();
        mods_array.retain(|m| m["id"].as_str() != Some(&mod_id));
        
        if mods_array.len() == original_len {
            return DeleteResult {
                success: false,
                error: Some("Mod not found in index.json".to_string()),
            };
        }
        
        index_json["totalMods"] = serde_json::json!(mods_array.len());
        index_json["lastUpdated"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    }
    
    // [STEP-4] Create blob for updated index.json
    let updated_index = serde_json::to_string_pretty(&index_json).unwrap();
    let index_base64 = BASE64.encode(updated_index.as_bytes());
    
    let index_blob = match client
        .post(format!("{}/git/blobs", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "content": index_base64,
            "encoding": "base64"
        }))
        .send()
        .await
    {
        Ok(resp) => resp.json::<GitHubBlobResponse>().await.unwrap(),
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to create index blob: {}", e)),
            };
        }
    };
    
    // [STEP-5] Get list of files in mod folder
    let contents_url = format!("{}/contents/mods/{}", api_base, mod_id);
    
    let files_response = match client
        .get(&contents_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return DeleteResult {
                    success: false,
                    error: Some("Mod folder not found".to_string()),
                };
            }
            resp.json::<Vec<serde_json::Value>>().await.unwrap_or_default()
        }
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to list mod files: {}", e)),
            };
        }
    };
    
    // [STEP-6] Build tree items to delete each file (sha: null removes file)
    let mut tree_items: Vec<serde_json::Value> = files_response
        .iter()
        .filter_map(|f| {
            f["path"].as_str().map(|path| {
                serde_json::json!({
                    "path": path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": serde_json::Value::Null
                })
            })
        })
        .collect();
    
    // Add updated index.json
    tree_items.push(serde_json::json!({
        "path": "index.json",
        "mode": "100644",
        "type": "blob",
        "sha": index_blob.sha
    }));
    
    println!("[MARKETPLACE-DELETE] Creating tree to remove {} files...", tree_items.len());
    
    // [STEP-7] Create tree
    let tree_response = match client
        .post(format!("{}/git/trees", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "base_tree": base_sha,
            "tree": tree_items
        }))
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let body = resp.text().await.unwrap_or_default();
                return DeleteResult {
                    success: false,
                    error: Some(format!("Failed to create delete tree: {}", body)),
                };
            }
            resp.json::<GitHubTreeResponse>().await.unwrap()
        }
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to create tree: {}", e)),
            };
        }
    };
    
    // [STEP-8] Create commit
    let commit_message = format!("[MARKETPLACE] Delete mod: {}", mod_id);
    
    let commit_response = match client
        .post(format!("{}/git/commits", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "message": commit_message,
            "tree": tree_response.sha,
            "parents": [base_sha]
        }))
        .send()
        .await
    {
        Ok(resp) => resp.json::<GitHubCommitResponse>().await.unwrap(),
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to create commit: {}", e)),
            };
        }
    };
    
    // [STEP-9] Update branch reference
    match client
        .patch(format!("{}/git/refs/heads/main", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "sha": commit_response.sha
        }))
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return DeleteResult {
                    success: false,
                    error: Some("Failed to update branch reference".to_string()),
                };
            }
        }
        Err(e) => {
            return DeleteResult {
                success: false,
                error: Some(format!("Failed to update ref: {}", e)),
            };
        }
    }
    
    println!("[MARKETPLACE-DELETE] Delete complete: {}", mod_id);
    
    DeleteResult {
        success: true,
        error: None,
    }
}

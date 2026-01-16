//! File: marketplace_upload.rs
//! Author: Wildflover
//! Description: Marketplace mod upload functionality for GitHub-based distribution
//!              - Upload mod files via GitHub Git Data API
//!              - Create blobs, trees, and commits atomically
//!              - Auto-update index.json catalog
//!              - Preview image handling
//! Language: Rust

use serde::{Deserialize, Serialize};
use reqwest::Client;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::marketplace::get_token;
use crate::marketplace_catalog::{
    GitHubBlobResponse, GitHubTreeItem, GitHubTreeResponse,
    GitHubCommitResponse, GitHubRefResponse,
};

// [STRUCT] Upload metadata from frontend
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadMetadata {
    pub name: String,
    pub author: String,
    pub author_id: String,
    pub author_avatar: Option<String>,
    pub description: String,
    pub title: String,
    pub tags: Vec<String>,
    pub version: String,
}

// [STRUCT] Upload result
#[derive(Serialize)]
pub struct UploadResult {
    pub success: bool,
    pub mod_id: Option<String>,
    pub commit_url: Option<String>,
    pub error: Option<String>,
}

// [FUNC] Generate unique mod ID from name
fn generate_mod_id(name: &str) -> String {
    let sanitized: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
        .collect::<String>()
        .replace(' ', "-");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    format!("{}-{}", sanitized, timestamp % 10000)
}


// [COMMAND] Upload mod to GitHub marketplace (admin only)
#[tauri::command]
pub async fn upload_marketplace_mod(
    metadata: UploadMetadata,
    file_path: String,
    preview_path: Option<String>,
    _github_token: String,
    github_owner: String,
    github_repo: String,
) -> UploadResult {
    println!("[MARKETPLACE-UPLOAD] Starting upload: {}", metadata.name);
    println!("[MARKETPLACE-UPLOAD] Author: {} ({})", metadata.author, metadata.author_id);
    
    let github_token = get_token();
    let mod_id = generate_mod_id(&metadata.name);
    println!("[MARKETPLACE-UPLOAD] Generated mod ID: {}", mod_id);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    let api_base = format!("https://api.github.com/repos/{}/{}", github_owner, github_repo);
    
    // [STEP-1] Read and encode mod file
    println!("[MARKETPLACE-UPLOAD] Reading mod file...");
    let mod_bytes = match std::fs::read(&file_path) {
        Ok(bytes) => bytes,
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to read mod file: {}", e)),
            };
        }
    };
    
    let mod_base64 = BASE64.encode(&mod_bytes);
    let file_size = mod_bytes.len() as u64;
    println!("[MARKETPLACE-UPLOAD] Mod file size: {} bytes", file_size);
    
    // [STEP-2] Create blob for mod file
    println!("[MARKETPLACE-UPLOAD] Creating blob for mod file...");
    let blob_response = match client
        .post(format!("{}/git/blobs", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "content": mod_base64,
            "encoding": "base64"
        }))
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return UploadResult {
                    success: false,
                    mod_id: None,
                    commit_url: None,
                    error: Some(format!("GitHub API error (blob): {} - {}", status, body)),
                };
            }
            resp.json::<GitHubBlobResponse>().await.unwrap()
        }
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to create blob: {}", e)),
            };
        }
    };
    
    let mod_blob_sha = blob_response.sha;
    println!("[MARKETPLACE-UPLOAD] Mod blob SHA: {}", mod_blob_sha);
    
    // [STEP-3] Create info.json
    let info_json = serde_json::json!({
        "id": mod_id,
        "name": metadata.name,
        "author": metadata.author,
        "authorId": metadata.author_id,
        "authorAvatar": metadata.author_avatar,
        "description": metadata.description,
        "title": metadata.title,
        "tags": metadata.tags,
        "version": metadata.version,
        "fileSize": file_size,
        "downloadCount": 0,
        "likeCount": 0,
        "createdAt": chrono::Utc::now().to_rfc3339(),
        "updatedAt": chrono::Utc::now().to_rfc3339()
    });
    
    let info_base64 = BASE64.encode(serde_json::to_string_pretty(&info_json).unwrap().as_bytes());
    
    println!("[MARKETPLACE-UPLOAD] Creating blob for info.json...");
    let info_blob_response = match client
        .post(format!("{}/git/blobs", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "content": info_base64,
            "encoding": "base64"
        }))
        .send()
        .await
    {
        Ok(resp) => resp.json::<GitHubBlobResponse>().await.unwrap(),
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to create info blob: {}", e)),
            };
        }
    };
    
    let info_blob_sha = info_blob_response.sha;
    
    // [STEP-4] Handle preview image if provided
    let mut preview_blob_sha: Option<String> = None;
    if let Some(ref preview) = preview_path {
        if std::path::Path::new(preview).exists() {
            println!("[MARKETPLACE-UPLOAD] Processing preview image...");
            if let Ok(preview_bytes) = std::fs::read(preview) {
                let preview_base64 = BASE64.encode(&preview_bytes);
                
                if let Ok(resp) = client
                    .post(format!("{}/git/blobs", api_base))
                    .header("Authorization", format!("Bearer {}", github_token))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "Wildflover-Marketplace")
                    .json(&serde_json::json!({
                        "content": preview_base64,
                        "encoding": "base64"
                    }))
                    .send()
                    .await
                {
                    if let Ok(blob) = resp.json::<GitHubBlobResponse>().await {
                        preview_blob_sha = Some(blob.sha);
                        println!("[MARKETPLACE-UPLOAD] Preview blob created");
                    }
                }
            }
        }
    }
    
    // [STEP-5] Get current main branch SHA
    println!("[MARKETPLACE-UPLOAD] Getting current branch SHA...");
    let ref_response = match client
        .get(format!("{}/git/ref/heads/main", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .send()
        .await
    {
        Ok(resp) => resp.json::<GitHubRefResponse>().await.unwrap(),
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to get branch ref: {}", e)),
            };
        }
    };
    
    let base_sha = ref_response.object.sha;
    println!("[MARKETPLACE-UPLOAD] Base SHA: {}", base_sha);
    
    // [STEP-6] Create tree with new files
    let mut tree_items = vec![
        GitHubTreeItem {
            path: format!("mods/{}/mod.fantome", mod_id),
            mode: "100644".to_string(),
            item_type: "blob".to_string(),
            sha: mod_blob_sha,
        },
        GitHubTreeItem {
            path: format!("mods/{}/info.json", mod_id),
            mode: "100644".to_string(),
            item_type: "blob".to_string(),
            sha: info_blob_sha,
        },
    ];
    
    if let Some(preview_sha) = preview_blob_sha {
        tree_items.push(GitHubTreeItem {
            path: format!("mods/{}/preview.jpg", mod_id),
            mode: "100644".to_string(),
            item_type: "blob".to_string(),
            sha: preview_sha,
        });
    }
    
    // [STEP-6.5] Fetch and update index.json
    update_index_json(&client, &github_token, &github_owner, &github_repo, &mod_id, &metadata, file_size, &mut tree_items).await;
    
    println!("[MARKETPLACE-UPLOAD] Creating tree with {} items...", tree_items.len());
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
        Ok(resp) => resp.json::<GitHubTreeResponse>().await.unwrap(),
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to create tree: {}", e)),
            };
        }
    };
    
    let tree_sha = tree_response.sha;
    
    // [STEP-7] Create commit
    println!("[MARKETPLACE-UPLOAD] Creating commit...");
    let commit_message = format!("[MARKETPLACE] Add mod: {} by {}", metadata.name, metadata.author);
    
    let commit_response = match client
        .post(format!("{}/git/commits", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "message": commit_message,
            "tree": tree_sha,
            "parents": [base_sha]
        }))
        .send()
        .await
    {
        Ok(resp) => resp.json::<GitHubCommitResponse>().await.unwrap(),
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to create commit: {}", e)),
            };
        }
    };
    
    let commit_sha = commit_response.sha;
    let commit_url = commit_response.html_url;
    
    // [STEP-8] Update branch reference
    println!("[MARKETPLACE-UPLOAD] Updating branch reference...");
    match client
        .patch(format!("{}/git/refs/heads/main", api_base))
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .json(&serde_json::json!({
            "sha": commit_sha
        }))
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                return UploadResult {
                    success: false,
                    mod_id: None,
                    commit_url: None,
                    error: Some("Failed to update branch reference".to_string()),
                };
            }
        }
        Err(e) => {
            return UploadResult {
                success: false,
                mod_id: None,
                commit_url: None,
                error: Some(format!("Failed to update ref: {}", e)),
            };
        }
    }
    
    println!("[MARKETPLACE-UPLOAD] Upload complete: {}", mod_id);
    println!("[MARKETPLACE-UPLOAD] Commit URL: {}", commit_url);
    
    UploadResult {
        success: true,
        mod_id: Some(mod_id),
        commit_url: Some(commit_url),
        error: None,
    }
}


// [FUNC] Update index.json with new mod entry
async fn update_index_json(
    client: &Client,
    github_token: &str,
    github_owner: &str,
    github_repo: &str,
    mod_id: &str,
    metadata: &UploadMetadata,
    file_size: u64,
    tree_items: &mut Vec<GitHubTreeItem>,
) {
    let api_base = format!("https://api.github.com/repos/{}/{}", github_owner, github_repo);
    let index_api_url = format!("{}/contents/index.json", api_base);
    
    println!("[MARKETPLACE-UPLOAD] Fetching current index.json via API...");
    
    let index_response = client
        .get(&index_api_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("Accept", "application/vnd.github.raw+json")
        .header("User-Agent", "Wildflover-Marketplace")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;
    
    if let Ok(resp) = index_response {
        if resp.status().is_success() {
            if let Ok(index_text) = resp.text().await {
                println!("[MARKETPLACE-UPLOAD] index.json fetched: {} bytes", index_text.len());
                if let Ok(mut index_json) = serde_json::from_str::<serde_json::Value>(&index_text) {
                    let current_count = index_json["mods"].as_array().map(|a| a.len()).unwrap_or(0);
                    println!("[MARKETPLACE-UPLOAD] Current mods count: {}", current_count);
                    
                    let now = chrono::Utc::now().to_rfc3339();
                    let download_url = format!(
                        "https://raw.githubusercontent.com/{}/{}/main/mods/{}/mod.fantome",
                        github_owner, github_repo, mod_id
                    );
                    let preview_url = format!(
                        "https://raw.githubusercontent.com/{}/{}/main/mods/{}/preview.jpg",
                        github_owner, github_repo, mod_id
                    );
                    
                    let new_mod = serde_json::json!({
                        "id": mod_id,
                        "name": metadata.name,
                        "author": metadata.author,
                        "authorId": metadata.author_id,
                        "authorAvatar": metadata.author_avatar,
                        "description": metadata.description,
                        "title": metadata.title,
                        "tags": metadata.tags,
                        "version": metadata.version,
                        "fileSize": file_size,
                        "downloadCount": 0,
                        "likeCount": 0,
                        "downloadUrl": download_url,
                        "previewUrl": preview_url,
                        "createdAt": now.clone(),
                        "updatedAt": now.clone()
                    });
                    
                    if let Some(mods_array) = index_json["mods"].as_array_mut() {
                        mods_array.push(new_mod);
                        let total_mods = mods_array.len();
                        println!("[MARKETPLACE-UPLOAD] New mods count: {}", total_mods);
                        index_json["totalMods"] = serde_json::json!(total_mods);
                        index_json["lastUpdated"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
                        
                        let updated_index = serde_json::to_string_pretty(&index_json).unwrap();
                        let index_base64 = BASE64.encode(updated_index.as_bytes());
                        
                        if let Ok(blob_resp) = client
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
                            if let Ok(blob) = blob_resp.json::<GitHubBlobResponse>().await {
                                tree_items.push(GitHubTreeItem {
                                    path: "index.json".to_string(),
                                    mode: "100644".to_string(),
                                    item_type: "blob".to_string(),
                                    sha: blob.sha,
                                });
                                println!("[MARKETPLACE-UPLOAD] index.json added to tree");
                            }
                        }
                    }
                }
            }
        }
    }
}

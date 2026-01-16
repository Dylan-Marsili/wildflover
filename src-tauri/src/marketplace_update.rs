/**
 * File: marketplace_update.rs
 * Author: Wildflover
 * Description: Rust backend for updating marketplace mod metadata on GitHub
 * Language: Rust
 */

use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::marketplace::get_token;

// [STRUCT] Update request data
#[derive(Debug, Deserialize)]
pub struct ModUpdates {
    pub name: String,
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
}

// [STRUCT] Update result with preview status
#[derive(Debug, Serialize)]
pub struct UpdateResult {
    pub success: bool,
    pub error: Option<String>,
    #[serde(rename = "previewUpdated")]
    pub preview_updated: bool,
}

// [STRUCT] GitHub file content response
#[derive(Debug, Deserialize)]
struct GitHubFileResponse {
    sha: String,
    content: Option<String>,
}

// [STRUCT] GitHub update request
#[derive(Debug, Serialize)]
struct GitHubUpdateRequest {
    message: String,
    content: String,
    sha: String,
    branch: String,
}

// [COMMAND] Update mod metadata on GitHub
#[tauri::command]
pub async fn update_marketplace_mod(
    mod_id: String,
    updates: ModUpdates,
    preview_base64: Option<String>,
    github_owner: String,
    github_repo: String,
) -> UpdateResult {
    println!("[MARKETPLACE-UPDATE] Updating mod: {}", mod_id);
    println!("[MARKETPLACE-UPDATE] Preview provided: {}", preview_base64.is_some());

    let github_token = get_token();
    let client = reqwest::Client::new();

    // Step 1: Fetch current index.json
    let index_url = format!(
        "https://api.github.com/repos/{}/{}/contents/index.json",
        github_owner, github_repo
    );

    let index_response = match client
        .get(&index_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("User-Agent", "Wildflover-Marketplace")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            return UpdateResult {
                success: false,
                error: Some(format!("Failed to fetch index: {}", e)),
                preview_updated: false,
            };
        }
    };

    if !index_response.status().is_success() {
        return UpdateResult {
            success: false,
            error: Some(format!("GitHub API error: {}", index_response.status())),
            preview_updated: false,
        };
    }

    let index_file: GitHubFileResponse = match index_response.json().await {
        Ok(data) => data,
        Err(e) => {
            return UpdateResult {
                success: false,
                error: Some(format!("Failed to parse index response: {}", e)),
                preview_updated: false,
            };
        }
    };

    // Decode index.json content
    let index_content = match &index_file.content {
        Some(content) => {
            let cleaned = content.replace('\n', "").replace('\r', "");
            match BASE64.decode(&cleaned) {
                Ok(bytes) => match String::from_utf8(bytes) {
                    Ok(s) => s,
                    Err(e) => {
                        return UpdateResult {
                            success: false,
                            error: Some(format!("Invalid UTF-8 in index: {}", e)),
                            preview_updated: false,
                        };
                    }
                },
                Err(e) => {
                    return UpdateResult {
                        success: false,
                        error: Some(format!("Failed to decode index: {}", e)),
                        preview_updated: false,
                    };
                }
            }
        }
        None => {
            return UpdateResult {
                success: false,
                error: Some("Index content is empty".to_string()),
                preview_updated: false,
            };
        }
    };

    // Parse and update index.json
    let mut index: serde_json::Value = match serde_json::from_str(&index_content) {
        Ok(v) => v,
        Err(e) => {
            return UpdateResult {
                success: false,
                error: Some(format!("Failed to parse index JSON: {}", e)),
                preview_updated: false,
            };
        }
    };

    // Find and update the mod
    let mut mod_found = false;
    if let Some(mods) = index.get_mut("mods").and_then(|m| m.as_array_mut()) {
        for mod_entry in mods.iter_mut() {
            if mod_entry.get("id").and_then(|id| id.as_str()) == Some(&mod_id) {
                mod_entry["name"] = serde_json::json!(updates.name);
                mod_entry["title"] = serde_json::json!(updates.title);
                mod_entry["description"] = serde_json::json!(updates.description);
                mod_entry["tags"] = serde_json::json!(updates.tags);
                mod_entry["updatedAt"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
                mod_found = true;
                break;
            }
        }
    }

    if !mod_found {
        return UpdateResult {
            success: false,
            error: Some(format!("Mod not found: {}", mod_id)),
            preview_updated: false,
        };
    }

    // Update index.json on GitHub
    let updated_index = serde_json::to_string_pretty(&index).unwrap();
    let encoded_index = BASE64.encode(updated_index.as_bytes());

    let update_request = GitHubUpdateRequest {
        message: format!("[MARKETPLACE-UPDATE] Updated mod: {}", mod_id),
        content: encoded_index,
        sha: index_file.sha,
        branch: "main".to_string(),
    };

    let update_response = match client
        .put(&index_url)
        .header("Authorization", format!("Bearer {}", github_token))
        .header("User-Agent", "Wildflover-Marketplace")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&update_request)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            return UpdateResult {
                success: false,
                error: Some(format!("Failed to update index: {}", e)),
                preview_updated: false,
            };
        }
    };

    if !update_response.status().is_success() {
        let error_text = update_response.text().await.unwrap_or_default();
        return UpdateResult {
            success: false,
            error: Some(format!("Failed to update index on GitHub: {}", error_text)),
            preview_updated: false,
        };
    }

    // Step 2: Update preview image if provided
    let mut preview_updated = false;
    
    if let Some(preview_data) = preview_base64 {
        println!("[MARKETPLACE-UPDATE] Updating preview image, data length: {}", preview_data.len());
        
        let preview_url = format!(
            "https://api.github.com/repos/{}/{}/contents/mods/{}/preview.jpg",
            github_owner, github_repo, mod_id
        );

        // Get current preview SHA (if exists)
        let preview_response = client
            .get(&preview_url)
            .header("Authorization", format!("Bearer {}", github_token))
            .header("User-Agent", "Wildflover-Marketplace")
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await;

        let existing_sha: Option<String> = if let Ok(resp) = preview_response {
            if resp.status().is_success() {
                if let Ok(preview_file) = resp.json::<GitHubFileResponse>().await {
                    println!("[MARKETPLACE-UPDATE] Existing preview SHA: {}", preview_file.sha);
                    Some(preview_file.sha)
                } else {
                    None
                }
            } else {
                println!("[MARKETPLACE-UPDATE] No existing preview found, will create new");
                None
            }
        } else {
            None
        };

        // Create or update preview image
        let preview_update = if let Some(sha) = existing_sha {
            serde_json::json!({
                "message": format!("[MARKETPLACE-UPDATE] Updated preview for: {}", mod_id),
                "content": preview_data,
                "sha": sha,
                "branch": "main"
            })
        } else {
            serde_json::json!({
                "message": format!("[MARKETPLACE-UPDATE] Added preview for: {}", mod_id),
                "content": preview_data,
                "branch": "main"
            })
        };

        let preview_result = client
            .put(&preview_url)
            .header("Authorization", format!("Bearer {}", github_token))
            .header("User-Agent", "Wildflover-Marketplace")
            .header("Accept", "application/vnd.github.v3+json")
            .json(&preview_update)
            .send()
            .await;

        match preview_result {
            Ok(resp) => {
                if resp.status().is_success() {
                    println!("[MARKETPLACE-UPDATE] Preview image updated successfully");
                    preview_updated = true;
                } else {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_default();
                    println!("[MARKETPLACE-UPDATE] Preview update failed: {} - {}", status, error_text);
                }
            }
            Err(e) => {
                println!("[MARKETPLACE-UPDATE] Preview update request failed: {}", e);
            }
        }
    }

    println!("[MARKETPLACE-UPDATE] Mod updated successfully: {}, preview: {}", mod_id, preview_updated);

    UpdateResult {
        success: true,
        error: None,
        preview_updated,
    }
}

//! File: discord.rs
//! Author: Wildflover
//! Description: Discord OAuth2 backend handler - Secure token exchange
//!              - Client secret stored in compiled binary (not exposed to frontend)
//!              - Token exchange and refresh operations
//!              - Enhanced error handling and timeout configuration
//! Language: Rust

use serde::{Deserialize, Serialize};
use std::time::Duration;

// [CONSTANTS] Discord OAuth2 configuration
// IMPORTANT: Replace these with your own Discord Application credentials
// Get yours at: https://discord.com/developers/applications
const DISCORD_CLIENT_ID: &str = "YOUR_DISCORD_CLIENT_ID";
const DISCORD_CLIENT_SECRET: &str = "YOUR_DISCORD_CLIENT_SECRET";
const DISCORD_TOKEN_URL: &str = "https://discord.com/api/oauth2/token";
const DISCORD_REVOKE_URL: &str = "https://discord.com/api/oauth2/token/revoke";

// [CONSTANTS] Network configuration - Optimized for faster failure detection
const REQUEST_TIMEOUT_SECS: u64 = 20;
const CONNECT_TIMEOUT_SECS: u64 = 10;
const MAX_RETRIES: u32 = 2;
const RETRY_DELAY_MS: u64 = 1000;

// [STRUCT] Discord token response
#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: String,
    pub scope: String,
}

// [STRUCT] Generic result for frontend
#[derive(Debug, Serialize)]
pub struct TokenResult {
    pub success: bool,
    pub data: Option<DiscordTokenResponse>,
    pub error: Option<String>,
}

// [HELPER] Create HTTP client with proper timeout configuration
fn create_http_client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .pool_idle_timeout(Duration::from_secs(90))
        .tcp_keepalive(Duration::from_secs(60))
        .pool_max_idle_per_host(2)
        .http2_adaptive_window(true)
        .build()
}

// [HELPER] Execute request with retry mechanism
async fn execute_with_retry<F, Fut, T>(
    operation: F,
    operation_name: &str,
) -> Result<T, String>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, reqwest::Error>>,
{
    let mut last_error = None;
    
    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            println!("[DISCORD-AUTH] Retry attempt {}/{} for {}", attempt, MAX_RETRIES, operation_name);
            tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * attempt as u64)).await;
        }
        
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    println!("[DISCORD-AUTH] {} succeeded on retry {}", operation_name, attempt);
                }
                return Ok(result);
            }
            Err(e) => {
                println!("[DISCORD-AUTH] {} attempt {} failed: {}", operation_name, attempt + 1, e);
                last_error = Some(e);
                
                if let Some(ref err) = last_error {
                    if err.is_status() {
                        break;
                    }
                }
            }
        }
    }
    
    if let Some(e) = last_error {
        Err(parse_network_error(&e))
    } else {
        Err(format!("{} failed after {} retries", operation_name, MAX_RETRIES))
    }
}

// [HELPER] Parse network error to user-friendly message
fn parse_network_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        return "Connection timeout. Please check your internet connection.".to_string();
    }
    if e.is_connect() {
        return "Could not connect to Discord. Please check your internet connection.".to_string();
    }
    if e.is_request() {
        return "Request failed. Please try again.".to_string();
    }
    format!("Network error: {}", e)
}

// [COMMAND] Exchange authorization code for tokens
#[tauri::command]
pub async fn discord_exchange_code(code: String, redirect_uri: String) -> TokenResult {
    println!("[DISCORD-AUTH] Exchanging authorization code for tokens...");
    println!("[DISCORD-AUTH] Using redirect_uri: {}", redirect_uri);
    
    let client = match create_http_client() {
        Ok(c) => c,
        Err(e) => {
            println!("[DISCORD-AUTH] Failed to create HTTP client: {}", e);
            return TokenResult {
                success: false,
                data: None,
                error: Some("Failed to initialize network client.".to_string()),
            };
        }
    };
    
    let params = [
        ("client_id", DISCORD_CLIENT_ID),
        ("client_secret", DISCORD_CLIENT_SECRET),
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", &redirect_uri),
    ];
    
    let response_result = execute_with_retry(
        || {
            let client = client.clone();
            let params = params.clone();
            async move {
                client
                    .post(DISCORD_TOKEN_URL)
                    .form(&params)
                    .send()
                    .await
            }
        },
        "Token exchange"
    ).await;
    
    let response = match response_result {
        Ok(r) => r,
        Err(e) => {
            println!("[DISCORD-AUTH] Token exchange failed after retries: {}", e);
            return TokenResult {
                success: false,
                data: None,
                error: Some(e),
            };
        }
    };
    
    let status = response.status();
    
    if status.is_success() {
        match response.json::<DiscordTokenResponse>().await {
            Ok(tokens) => {
                println!("[DISCORD-AUTH] Token exchange successful");
                TokenResult {
                    success: true,
                    data: Some(tokens),
                    error: None,
                }
            }
            Err(e) => {
                println!("[DISCORD-AUTH] Failed to parse token response: {}", e);
                TokenResult {
                    success: false,
                    data: None,
                    error: Some("Failed to parse Discord response.".to_string()),
                }
            }
        }
    } else if status.as_u16() == 429 {
        println!("[DISCORD-AUTH] Rate limited by Discord API");
        TokenResult {
            success: false,
            data: None,
            error: Some("Too many requests. Please wait a moment and try again.".to_string()),
        }
    } else if status.as_u16() == 400 {
        let error_text = response.text().await.unwrap_or_default();
        println!("[DISCORD-AUTH] Bad request: {}", error_text);
        if error_text.contains("invalid_grant") {
            TokenResult {
                success: false,
                data: None,
                error: Some("Login session expired. Please try again.".to_string()),
            }
        } else {
            TokenResult {
                success: false,
                data: None,
                error: Some("Authentication failed. Please try again.".to_string()),
            }
        }
    } else {
        let error_text = response.text().await.unwrap_or_default();
        println!("[DISCORD-AUTH] Token exchange failed: {} - {}", status, error_text);
        TokenResult {
            success: false,
            data: None,
            error: Some("Discord authentication failed. Please try again.".to_string()),
        }
    }
}

// [COMMAND] Refresh access token using refresh token
#[tauri::command]
pub async fn discord_refresh_token(refresh_token: String) -> TokenResult {
    println!("[DISCORD-AUTH] Refreshing access token...");
    
    let client = match create_http_client() {
        Ok(c) => c,
        Err(e) => {
            println!("[DISCORD-AUTH] Failed to create HTTP client: {}", e);
            return TokenResult {
                success: false,
                data: None,
                error: Some("Failed to initialize network client.".to_string()),
            };
        }
    };
    
    let params = [
        ("client_id", DISCORD_CLIENT_ID),
        ("client_secret", DISCORD_CLIENT_SECRET),
        ("grant_type", "refresh_token"),
        ("refresh_token", &refresh_token),
    ];
    
    let response_result = execute_with_retry(
        || {
            let client = client.clone();
            let params = params.clone();
            async move {
                client
                    .post(DISCORD_TOKEN_URL)
                    .form(&params)
                    .send()
                    .await
            }
        },
        "Token refresh"
    ).await;
    
    let response = match response_result {
        Ok(r) => r,
        Err(e) => {
            println!("[DISCORD-AUTH] Token refresh failed after retries: {}", e);
            return TokenResult {
                success: false,
                data: None,
                error: Some(e),
            };
        }
    };
    
    let status = response.status();
    
    if status.is_success() {
        match response.json::<DiscordTokenResponse>().await {
            Ok(tokens) => {
                println!("[DISCORD-AUTH] Token refresh successful");
                TokenResult {
                    success: true,
                    data: Some(tokens),
                    error: None,
                }
            }
            Err(e) => {
                println!("[DISCORD-AUTH] Failed to parse refresh response: {}", e);
                TokenResult {
                    success: false,
                    data: None,
                    error: Some("Failed to parse Discord response.".to_string()),
                }
            }
        }
    } else if status.as_u16() == 429 {
        println!("[DISCORD-AUTH] Rate limited during token refresh");
        TokenResult {
            success: false,
            data: None,
            error: Some("Too many requests. Please wait a moment and try again.".to_string()),
        }
    } else if status.as_u16() == 400 {
        println!("[DISCORD-AUTH] Invalid refresh token");
        TokenResult {
            success: false,
            data: None,
            error: Some("Session expired. Please login again.".to_string()),
        }
    } else {
        let error_text = response.text().await.unwrap_or_default();
        println!("[DISCORD-AUTH] Token refresh failed: {} - {}", status, error_text);
        TokenResult {
            success: false,
            data: None,
            error: Some("Token refresh failed. Please login again.".to_string()),
        }
    }
}

// [COMMAND] Revoke access token
#[tauri::command]
pub async fn discord_revoke_token(token: String) -> TokenResult {
    println!("[DISCORD-AUTH] Revoking access token...");
    
    let client = match create_http_client() {
        Ok(c) => c,
        Err(_) => {
            return TokenResult {
                success: true,
                data: None,
                error: None,
            };
        }
    };
    
    let params = [
        ("client_id", DISCORD_CLIENT_ID),
        ("client_secret", DISCORD_CLIENT_SECRET),
        ("token", &token),
    ];
    
    match client
        .post(DISCORD_REVOKE_URL)
        .form(&params)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            
            if status.is_success() || status.as_u16() == 200 {
                println!("[DISCORD-AUTH] Token revocation successful");
            } else {
                let error_text = response.text().await.unwrap_or_default();
                println!("[DISCORD-AUTH] Token revocation failed: {} - {}", status, error_text);
            }
            TokenResult {
                success: true,
                data: None,
                error: None,
            }
        }
        Err(e) => {
            println!("[DISCORD-AUTH] Network error during token revocation: {}", e);
            TokenResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}

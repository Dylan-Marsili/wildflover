//! File: discord_rpc.rs
//! Author: Wildflover
//! Description: Discord Rich Presence integration - Optimized async version
//!              - Non-blocking activity updates
//!              - Background thread for Discord IPC
//! Language: Rust

use discord_presence::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use std::thread;

// [CONSTANTS] Discord Application ID
const DISCORD_APP_ID: u64 = 1458923588475293872;

// [CONSTANTS] Button configuration
const BUTTON_LABEL: &str = "Join Discord";
const BUTTON_URL: &str = "https://discord.gg/nJVc4JSwgW";

// [STATE] Global Discord client
static DISCORD_CLIENT: Mutex<Option<Client>> = Mutex::new(None);

// [STATE] RPC enabled flag
static RPC_ENABLED: Mutex<bool> = Mutex::new(false);

// [STATE] Start timestamp
static START_TIME: Mutex<Option<u64>> = Mutex::new(None);

// [STATE] Last activity cache to prevent duplicate updates
static LAST_ACTIVITY: Mutex<Option<String>> = Mutex::new(None);

// [STRUCT] RPC result for frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RpcResult {
    pub success: bool,
    pub message: String,
}

// [FUNC] Get current unix timestamp
fn get_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// [COMMAND] Initialize and enable Discord RPC
#[tauri::command]
pub fn set_rpc_enabled(enabled: bool) -> RpcResult {
    if enabled {
        // [ASYNC] Start connection in background thread
        thread::spawn(|| {
            let mut client_guard = DISCORD_CLIENT.lock().unwrap();
            
            if client_guard.is_none() {
                let mut client = Client::new(DISCORD_APP_ID);
                
                client.on_ready(|_ctx| {
                    println!("[DISCORD-RPC] Client ready");
                }).persist();
                
                client.start();
                
                *client_guard = Some(client);
                
                let mut start = START_TIME.lock().unwrap();
                if start.is_none() {
                    *start = Some(get_unix_timestamp());
                }
            }
            
            *RPC_ENABLED.lock().unwrap() = true;
            println!("[DISCORD-RPC] Enabled");
        });
        
        RpcResult { success: true, message: "RPC enabling".to_string() }
    } else {
        *RPC_ENABLED.lock().unwrap() = false;
        
        thread::spawn(|| {
            let mut client_guard = DISCORD_CLIENT.lock().unwrap();
            if let Some(ref mut client) = *client_guard {
                let _ = client.clear_activity();
            }
            *client_guard = None;
        });
        
        println!("[DISCORD-RPC] Disabled");
        RpcResult { success: true, message: "RPC disabled".to_string() }
    }
}

// [COMMAND] Check if RPC is enabled
#[tauri::command]
pub fn is_rpc_enabled() -> bool {
    *RPC_ENABLED.lock().unwrap()
}

// [COMMAND] Update Discord activity - Fire and forget
#[tauri::command]
pub fn update_activity(
    state: String,
    details: String,
    large_image: String,
    large_text: String,
    small_image: Option<String>,
    small_text: Option<String>,
) -> RpcResult {
    // [CHECK] Skip if disabled
    if !*RPC_ENABLED.lock().unwrap() {
        return RpcResult { success: false, message: "RPC disabled".to_string() };
    }

    // [CACHE] Create activity hash to prevent duplicates
    let activity_hash = format!("{}|{}", state, details);
    {
        let mut last = LAST_ACTIVITY.lock().unwrap();
        if last.as_ref() == Some(&activity_hash) {
            return RpcResult { success: true, message: "Activity unchanged".to_string() };
        }
        *last = Some(activity_hash);
    }

    // [ASYNC] Update in background thread
    thread::spawn(move || {
        let mut client_guard = DISCORD_CLIENT.lock().unwrap();
        
        if let Some(ref mut client) = *client_guard {
            let start_time = START_TIME.lock().unwrap().unwrap_or_else(get_unix_timestamp);
            
            let _ = client.set_activity(|act| {
                let activity = act
                    .state(&state)
                    .details(&details)
                    .timestamps(|ts| ts.start(start_time))
                    .assets(|assets| {
                        let mut a = assets
                            .large_image(&large_image)
                            .large_text(&large_text);
                        
                        if let (Some(ref img), Some(ref txt)) = (&small_image, &small_text) {
                            a = a.small_image(img).small_text(txt);
                        }
                        a
                    });
                
                activity.append_buttons(|btn| {
                    btn.label(BUTTON_LABEL).url(BUTTON_URL)
                })
            });
            
            println!("[DISCORD-RPC] Updated: {}", state);
        }
    });

    RpcResult { success: true, message: "Activity updating".to_string() }
}

// [COMMAND] Clear Discord activity
#[tauri::command]
pub fn clear_activity() -> RpcResult {
    thread::spawn(|| {
        let mut client_guard = DISCORD_CLIENT.lock().unwrap();
        if let Some(ref mut client) = *client_guard {
            let _ = client.clear_activity();
        }
    });
    
    RpcResult { success: true, message: "Clearing".to_string() }
}

// [COMMAND] Get start timestamp
#[tauri::command]
pub fn get_start_timestamp() -> Option<u64> {
    *START_TIME.lock().unwrap()
}

// [COMMAND] Reset start timestamp
#[tauri::command]
pub fn reset_timestamp() -> RpcResult {
    let mut start = START_TIME.lock().unwrap();
    *start = Some(get_unix_timestamp());
    RpcResult { success: true, message: "Reset".to_string() }
}

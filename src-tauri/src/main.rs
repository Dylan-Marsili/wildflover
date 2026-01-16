//! File: main.rs
//! Author: Wildflover
//! Description: Tauri backend entry point with system tray and Discord RPC
//!              - Minimize to tray support
//!              - Discord OAuth2 secure token handling
//!              - Discord Rich Presence integration
//!              - Custom mod file selection
//!              - Mod download and activation
//! Language: Rust

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod discord;
mod discord_rpc;
mod webhook;
mod mod_manager;
mod marketplace;
mod marketplace_catalog;
mod marketplace_delete;
mod marketplace_like;
mod marketplace_upload;
mod marketplace_download_count;
mod marketplace_update;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use discord::{discord_exchange_code, discord_refresh_token, discord_revoke_token};
use discord_rpc::{
    set_rpc_enabled, is_rpc_enabled, update_activity, 
    clear_activity, get_start_timestamp, reset_timestamp
};
use webhook::{send_login_webhook, send_logout_webhook};
use mod_manager::{download_skin, activate_mods, detect_game_path, set_game_path, browse_game_path, clear_game_path, cleanup_overlay, stop_overlay, is_overlay_running, clear_mods_cache, get_cache_info, clear_cache, delete_cache_file, delete_custom_mod_cache, run_diagnostic};

use marketplace::{download_marketplace_mod, clear_marketplace_cache, fetch_marketplace_catalog, delete_marketplace_mod_cache, fetch_mod_preview};
use marketplace_like::like_marketplace_mod;
use marketplace_upload::upload_marketplace_mod;
use marketplace_delete::delete_marketplace_mod;
use marketplace_download_count::increment_download_count;
use marketplace_update::update_marketplace_mod;
use serde::Serialize;

// [STATE] Global flag for minimize to tray setting
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(false);

// [COMMAND] Open folder in Windows Explorer
#[tauri::command]
fn open_folder_in_explorer(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open finder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    
    println!("[SYSTEM-EXPLORER] Opened folder: {}", path);
    Ok(())
}

// [STRUCT] File info for custom mod selection
#[derive(Serialize)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
}

// [STRUCT] File selection result
#[derive(Serialize)]
struct FileSelectionResult {
    success: bool,
    files: Vec<FileInfo>,
}

// [COMMAND] Update minimize to tray setting from frontend
#[tauri::command]
fn set_minimize_to_tray(enabled: bool) {
    println!("[SETTINGS-UPDATE] Minimize to tray: {}", enabled);
    MINIMIZE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

// [COMMAND] Get current minimize to tray setting
#[tauri::command]
fn get_minimize_to_tray() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::SeqCst)
}

// [COMMAND] Open file dialog for custom mod files (.wad, .wad.client, .zip, .fantome)
#[tauri::command]
async fn select_custom_files() -> FileSelectionResult {
    use std::path::Path;
    
    println!("[CUSTOMS-SELECT] Opening file dialog for custom mods...");
    
    let dialog = rfd::FileDialog::new()
        .add_filter("Custom Mods", &["wad", "zip", "fantome"])
        .add_filter("Fantome Files", &["fantome"])
        .add_filter("WAD Files", &["wad"])
        .add_filter("ZIP Files", &["zip"])
        .set_title("Select Custom Mod Files")
        .pick_files();
    
    match dialog {
        Some(paths) => {
            let mut files: Vec<FileInfo> = Vec::new();
            
            for path in paths {
                let path_str = path.to_string_lossy().to_string();
                let name = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                
                // Get file size
                let size = std::fs::metadata(&path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                
                // Check for .wad.client extension
                let final_name = if path_str.to_lowercase().ends_with(".wad.client") {
                    Path::new(&path_str)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or(name)
                } else {
                    name
                };
                
                println!("[CUSTOMS-SELECT] Selected: {} ({} bytes)", final_name, size);
                
                files.push(FileInfo {
                    name: final_name,
                    path: path_str,
                    size,
                });
            }
            
            println!("[CUSTOMS-SELECT] Total files selected: {}", files.len());
            
            FileSelectionResult {
                success: true,
                files,
            }
        }
        None => {
            println!("[CUSTOMS-SELECT] File dialog cancelled");
            FileSelectionResult {
                success: false,
                files: Vec::new(),
            }
        }
    }
}

// [COMMAND] Open file dialog for preview image selection
#[tauri::command]
async fn select_preview_image() -> FileSelectionResult {
    println!("[PREVIEW-SELECT] Opening file dialog for preview image...");
    
    let dialog = rfd::FileDialog::new()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp"])
        .add_filter("JPEG", &["jpg", "jpeg"])
        .add_filter("PNG", &["png"])
        .set_title("Select Preview Image")
        .pick_file();
    
    match dialog {
        Some(path) => {
            let path_str = path.to_string_lossy().to_string();
            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "preview.jpg".to_string());
            
            let size = std::fs::metadata(&path)
                .map(|m| m.len())
                .unwrap_or(0);
            
            println!("[PREVIEW-SELECT] Selected: {} ({} bytes)", name, size);
            
            FileSelectionResult {
                success: true,
                files: vec![FileInfo { name, path: path_str, size }],
            }
        }
        None => {
            println!("[PREVIEW-SELECT] File dialog cancelled");
            FileSelectionResult {
                success: false,
                files: Vec::new(),
            }
        }
    }
}

// [STRUCT] Preview selection result with base64 data
#[derive(Serialize)]
struct PreviewSelectionResult {
    success: bool,
    files: Vec<FileInfo>,
    base64: Option<String>,
}

// [COMMAND] Open file dialog for preview image and return base64 data
#[tauri::command]
async fn select_preview_image_with_data() -> PreviewSelectionResult {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    
    println!("[PREVIEW-SELECT] Opening file dialog for preview image with data...");
    
    let dialog = rfd::FileDialog::new()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp"])
        .add_filter("JPEG", &["jpg", "jpeg"])
        .add_filter("PNG", &["png"])
        .set_title("Select Preview Image")
        .pick_file();
    
    match dialog {
        Some(path) => {
            let path_str = path.to_string_lossy().to_string();
            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "preview.jpg".to_string());
            
            let size = std::fs::metadata(&path)
                .map(|m| m.len())
                .unwrap_or(0);
            
            // Read file and encode to base64
            let base64_data = match std::fs::read(&path) {
                Ok(bytes) => {
                    println!("[PREVIEW-SELECT] Read {} bytes, encoding to base64...", bytes.len());
                    Some(BASE64.encode(&bytes))
                }
                Err(e) => {
                    println!("[PREVIEW-SELECT] Failed to read file: {}", e);
                    None
                }
            };
            
            println!("[PREVIEW-SELECT] Selected: {} ({} bytes)", name, size);
            
            PreviewSelectionResult {
                success: true,
                files: vec![FileInfo { name, path: path_str, size }],
                base64: base64_data,
            }
        }
        None => {
            println!("[PREVIEW-SELECT] File dialog cancelled");
            PreviewSelectionResult {
                success: false,
                files: Vec::new(),
                base64: None,
            }
        }
    }
}

// [COMMAND] Get file info for drag-drop operations
#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    
    let size = std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    println!("[FILE-INFO] Retrieved info for: {} ({} bytes)", name, size);
    
    Ok(FileInfo {
        name,
        path,
        size,
    })
}

fn main() {
    println!("[SYSTEM-INIT] Wildflover LoL Skin Changer v1.0.0");
    println!("[SYSTEM-INIT] Initializing Tauri runtime with tray support...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_minimize_to_tray, 
            get_minimize_to_tray,
            select_custom_files,
            select_preview_image,
            select_preview_image_with_data,
            get_file_info,
            open_folder_in_explorer,
            discord_exchange_code,
            discord_refresh_token,
            discord_revoke_token,
            set_rpc_enabled,
            is_rpc_enabled,
            update_activity,
            clear_activity,
            get_start_timestamp,
            reset_timestamp,
            send_login_webhook,
            send_logout_webhook,
            download_skin,
            activate_mods,
            detect_game_path,
            set_game_path,
            browse_game_path,
            clear_game_path,
            cleanup_overlay,
            stop_overlay,
            is_overlay_running,
            clear_mods_cache,
            get_cache_info,
            clear_cache,
            delete_cache_file,
            delete_custom_mod_cache,
            run_diagnostic,
            download_marketplace_mod,
            upload_marketplace_mod,
            clear_marketplace_cache,
            delete_marketplace_mod_cache,
            like_marketplace_mod,
            fetch_marketplace_catalog,
            fetch_mod_preview,
            delete_marketplace_mod,
            increment_download_count,
            update_marketplace_mod,

        ])
        .setup(|app| {
            println!("[SYSTEM-READY] Application initialized successfully");
            println!("[SYSTEM-INFO] Author: Wildflover");
            println!("[SYSTEM-INFO] Frontend: React + TypeScript");
            println!("[SYSTEM-INFO] Tray: Conditional");
            println!("[SYSTEM-INFO] Discord RPC: Integrated");

            // [TRAY-MENU] Create context menu items
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;

            // [TRAY-MENU] Build menu
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // [TRAY-ICON] Build system tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Wildflover - LoL Skin Manager")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        println!("[TRAY-ACTION] Show window requested");
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        println!("[TRAY-ACTION] Application exit requested");
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // [TRAY-EVENT] Handle left click to show window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        println!("[TRAY-EVENT] Tray icon clicked - showing window");
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            println!("[TRAY-INIT] System tray initialized successfully");
            Ok(())
        })
        .on_window_event(|window, event| {
            // [WINDOW-EVENT] Handle close request based on setting
            if let WindowEvent::CloseRequested { api, .. } = event {
                let minimize_enabled = MINIMIZE_TO_TRAY.load(Ordering::SeqCst);
                
                if minimize_enabled {
                    println!("[WINDOW-EVENT] Close requested - minimizing to tray");
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    println!("[WINDOW-EVENT] Close requested - exiting application");
                    // Allow normal close behavior
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("[SYSTEM-ERROR] Failed to run application");
}

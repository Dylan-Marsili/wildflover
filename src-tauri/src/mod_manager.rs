//! File: mod_manager.rs
//! Author: Wildflover
//! Description: Mod management module for downloading skins and activating mods
//!              - GitHub skin download with retry and proxy support
//!              - ZIP extraction for mod files
//!              - mod-tools.exe integration for overlay creation
//!              - Persistent overlay process management (bocchi-style)
//! Language: Rust

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use tokio::fs;
use reqwest::Client;
use zip::ZipArchive;

// [WINDOWS] Import for hiding console window
#[cfg(windows)]
use std::os::windows::process::CommandExt;

// [CONST] Windows flag to hide console window
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// [STATE] Global overlay process holder - keeps process alive
lazy_static::lazy_static! {
    static ref OVERLAY_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

// [STRUCT] Skin download request
#[derive(Deserialize)]
pub struct SkinDownloadRequest {
    pub champion_id: i32,
    pub skin_id: i32,
    pub chroma_id: Option<i32>,
    pub form_id: Option<i32>,
}

// [STRUCT] Download result
#[derive(Serialize)]
pub struct DownloadResult {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

// [STRUCT] Activation result
#[derive(Serialize)]
pub struct ActivationResult {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
    pub vanguard_blocked: bool,
}

// [STRUCT] Mod item for activation
#[derive(Deserialize)]
pub struct ModItem {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub _is_custom: bool,  // Prefixed with underscore - reserved for future use
}

// [CONST] GitHub raw content URL for skins
const GITHUB_BASE_URL: &str = "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins";

// [CONST] DLL configuration - uses local cslol-dll.dll from managers folder
const DLL_FILE_NAME: &str = "cslol-dll.dll";



// [FUNC] Get app data directory for storing downloaded mods
fn get_mods_directory() -> PathBuf {
    let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    app_data.join("Wildflover").join("mods")
}

// [FUNC] Get overlay directory
fn get_overlay_directory() -> PathBuf {
    let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    app_data.join("Wildflover").join("overlay")
}



// [FUNC] Verify DLL exists in managers directory
fn verify_dll_exists(managers_dir: &PathBuf) -> Result<(), String> {
    let dll_path = managers_dir.join(DLL_FILE_NAME);
    
    if dll_path.exists() {
        println!("[DLL-CHECK] Local DLL found: {:?}", dll_path);
        Ok(())
    } else {
        Err(format!("DLL not found: {:?} - Please ensure {} is in managers folder", dll_path, DLL_FILE_NAME))
    }
}

// [FUNC] Get managers directory with multiple fallback paths
fn get_managers_directory() -> Option<PathBuf> {
    // Priority 1: Relative to current exe (production)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let managers = parent.join("managers");
            if managers.join("mod-tools.exe").exists() {
                println!("[MOD-PATH] Found managers at exe: {:?}", managers);
                return Some(managers);
            }
        }
    }
    
    // Priority 2: Current working directory
    let cwd_managers = PathBuf::from("managers");
    if cwd_managers.join("mod-tools.exe").exists() {
        println!("[MOD-PATH] Found managers at cwd: {:?}", cwd_managers);
        return Some(cwd_managers);
    }
    
    // Priority 3: Workspace root (Tauri dev mode)
    if let Ok(cwd) = std::env::current_dir() {
        // From src-tauri go up to workspace
        if let Some(parent) = cwd.parent() {
            let workspace_managers = parent.join("managers");
            if workspace_managers.join("mod-tools.exe").exists() {
                println!("[MOD-PATH] Found managers at workspace: {:?}", workspace_managers);
                return Some(workspace_managers);
            }
        }
        
        // Direct in cwd
        let direct = cwd.join("managers");
        if direct.join("mod-tools.exe").exists() {
            println!("[MOD-PATH] Found managers at direct: {:?}", direct);
            return Some(direct);
        }
    }
    
    println!("[MOD-PATH] ERROR: managers directory not found!");
    None
}


// [FUNC] Extract ZIP file to target directory
// Filters out locale-specific WAD files and problematic assets that can cause game crashes
fn extract_zip(zip_path: &PathBuf, target_dir: &PathBuf) -> Result<(), String> {
    let file = File::open(zip_path)
        .map_err(|e| format!("Failed to open ZIP: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid ZIP archive: {}", e))?;
    
    println!("[MOD-EXTRACT] Extracting {} files from {:?}", archive.len(), zip_path);
    
    // [FILTER] Locale patterns to skip - these cause game crashes
    let locale_patterns = [
        ".tr_TR.", ".en_US.", ".en_GB.", ".de_DE.", ".es_ES.", ".es_MX.",
        ".fr_FR.", ".it_IT.", ".pl_PL.", ".pt_BR.", ".ro_RO.", ".ru_RU.",
        ".el_GR.", ".cs_CZ.", ".hu_HU.", ".ja_JP.", ".ko_KR.", ".zh_CN.",
        ".zh_TW.", ".th_TH.", ".vi_VN.", ".ar_AE.", ".id_ID.", ".ms_MY.",
        ".ph_PH.", ".sg_SG.", ".tw_TW."
    ];
    
    // [FILTER] TFT-related patterns to skip - can cause crashes with regular LoL
    let tft_patterns = [
        "TFT", "tft", "Teamfight", "teamfight",
        "Map22", "Map30", "Map33"  // TFT map IDs
    ];
    
    // [FILTER] Problematic asset patterns that can cause crashes
    let crash_patterns = [
        "Announcer",      // Announcer voice files can conflict
        "LoadScreen",     // Some loadscreen files cause issues
        ".luabin",        // Lua scripts can cause crashes if incompatible
    ];
    
    let mut extracted_count = 0;
    let mut skipped_count = 0;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        let file_name = file.name().to_string();
        
        // [SKIP] Locale-specific WAD files
        let is_locale_file = locale_patterns.iter().any(|p| file_name.contains(p));
        if is_locale_file {
            println!("[MOD-EXTRACT] Skipping locale file: {}", file_name);
            skipped_count += 1;
            continue;
        }
        
        // [SKIP] TFT-related files (crash prevention)
        let is_tft_file = tft_patterns.iter().any(|p| file_name.contains(p));
        if is_tft_file {
            println!("[MOD-EXTRACT] Skipping TFT file: {}", file_name);
            skipped_count += 1;
            continue;
        }
        
        // [SKIP] Known problematic assets (optional - only skip if causing issues)
        let is_crash_prone = crash_patterns.iter().any(|p| file_name.contains(p));
        if is_crash_prone && file_name.ends_with(".wad.client") {
            println!("[MOD-EXTRACT] Skipping crash-prone file: {}", file_name);
            skipped_count += 1;
            continue;
        }
        
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };
        
        if file.name().ends_with('/') {
            // Directory entry
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            // File entry
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read ZIP content: {}", e))?;
            
            outfile.write_all(&buffer)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            
            extracted_count += 1;
        }
    }
    
    println!("[MOD-EXTRACT] Extraction complete: {} extracted, {} files skipped (locale/TFT/crash-prone)", 
             extracted_count, skipped_count);
    Ok(())
}

// [COMMAND] Download skin from GitHub - with cache check
#[tauri::command]
pub async fn download_skin(request: SkinDownloadRequest) -> DownloadResult {
    println!("[MOD-DOWNLOAD] Starting download for champion {} skin {}", 
             request.champion_id, request.skin_id);
    
    // Build unique mod folder name - include form_id if present
    let mod_folder_name = if request.chroma_id.is_some() {
        format!("{}_{}_chroma_{}", request.champion_id, request.skin_id, request.chroma_id.unwrap())
    } else if request.form_id.is_some() {
        format!("{}_{}_form_{}", request.champion_id, request.skin_id, request.form_id.unwrap())
    } else {
        format!("{}_{}", request.champion_id, request.skin_id)
    };
    
    let mods_dir = get_mods_directory();
    let mod_folder = mods_dir.join(&mod_folder_name);
    
    // [CACHE-CHECK] If already downloaded and has valid structure, skip download
    if mod_folder.exists() && mod_folder.is_dir() {
        let wad_dir = mod_folder.join("WAD");
        let meta_dir = mod_folder.join("META");
        
        if wad_dir.exists() && meta_dir.exists() {
            // Check if WAD folder has .wad.client files
            if let Ok(entries) = std::fs::read_dir(&wad_dir) {
                let has_wad = entries.filter_map(|e| e.ok())
                    .any(|e| e.path().to_string_lossy().ends_with(".wad.client"));
                
                if has_wad {
                    println!("[MOD-DOWNLOAD] Cache hit - using existing: {:?}", mod_folder);
                    return DownloadResult {
                        success: true,
                        path: Some(mod_folder.to_string_lossy().to_string()),
                        error: None,
                    };
                }
            }
        }
    }
    
    // Build download URLs - form has special path structure
    // Form URL: /skins/{champion_id}/{skin_id}/{form_id}/{form_id}.zip
    // Chroma URL: /skins/{champion_id}/{skin_id}/{chroma_id}/{chroma_id}.zip
    // Normal URL: /skins/{champion_id}/{skin_id}/{skin_id}.zip
    // 
    // [SPECIAL-CASE] Mordekaiser Sahn-Uzal (82054) uses special fantome path
    // URL: /skins/82/82054/82999/82999.fantome
    let (primary_url, fallback_url) = if request.champion_id == 82 && request.skin_id == 82054 && request.chroma_id.is_none() && request.form_id.is_none() {
        // [MORDEKAISER-SAHN-UZAL] Special case - use 82999 fantome file
        let fantome_url = format!("{}/82/82054/82999/82999.fantome", GITHUB_BASE_URL);
        let zip_url = format!("{}/82/82054/82999/82999.zip", GITHUB_BASE_URL);
        println!("[MOD-DOWNLOAD] Using Mordekaiser Sahn-Uzal special path: {}", fantome_url);
        (fantome_url, zip_url)
    } else if let Some(form_id) = request.form_id {
        // [SPECIAL-CASE] Ahri Immortalized Legend form mapping
        // API returns 103086 but GitHub uses 103087
        let actual_form_id = if form_id == 103086 {
            103087
        } else {
            form_id
        };
        
        let zip_url = format!("{}/{}/{}/{}/{}.zip", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                actual_form_id,
                actual_form_id);
        let fantome_url = format!("{}/{}/{}/{}/{}.fantome", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                actual_form_id,
                actual_form_id);
        (zip_url, fantome_url)
    } else if let Some(chroma_id) = request.chroma_id {
        let zip_url = format!("{}/{}/{}/{}/{}.zip", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                chroma_id,
                chroma_id);
        let fantome_url = format!("{}/{}/{}/{}/{}.fantome", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                chroma_id,
                chroma_id);
        (zip_url, fantome_url)
    } else {
        let zip_url = format!("{}/{}/{}/{}.zip", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                request.skin_id);
        let fantome_url = format!("{}/{}/{}/{}.fantome", 
                GITHUB_BASE_URL, 
                request.champion_id, 
                request.skin_id,
                request.skin_id);
        (zip_url, fantome_url)
    };
    
    println!("[MOD-DOWNLOAD] Primary URL: {}", primary_url);
    println!("[MOD-DOWNLOAD] Fallback URL: {}", fallback_url);
    
    // Create mods directory
    if let Err(e) = fs::create_dir_all(&mods_dir).await {
        return DownloadResult {
            success: false,
            path: None,
            error: Some(format!("Failed to create mods directory: {}", e)),
        };
    }
    
    // Create HTTP client with timeout
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| Client::new());
    
    // Try primary URL (.zip) first, then fallback (.fantome)
    let urls_to_try = vec![
        (primary_url.clone(), "zip"),
        (fallback_url.clone(), "fantome"),
    ];
    
    for (url, file_type) in urls_to_try {
        println!("[MOD-DOWNLOAD] Trying {} file: {}", file_type, url);
        
        let download_path = mods_dir.join(format!("{}.{}", mod_folder_name, file_type));
        
        // Download with retry
        let mut attempts = 0;
        let max_attempts = 2;
        
        while attempts < max_attempts {
            attempts += 1;
            println!("[MOD-DOWNLOAD] Attempt {}/{} for {}", attempts, max_attempts, file_type);
            
            match client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.bytes().await {
                            Ok(bytes) => {
                                // Save file
                                if let Err(e) = fs::write(&download_path, &bytes).await {
                                    println!("[MOD-DOWNLOAD] Failed to write {}: {}", file_type, e);
                                    continue;
                                }
                                
                                println!("[MOD-DOWNLOAD] {} saved: {:?} ({} bytes)", 
                                         file_type.to_uppercase(), download_path, bytes.len());
                                
                                // Clean existing folder if any
                                if mod_folder.exists() {
                                    let _ = std::fs::remove_dir_all(&mod_folder);
                                }
                                
                                // Create mod folder
                                if let Err(e) = std::fs::create_dir_all(&mod_folder) {
                                    let _ = std::fs::remove_file(&download_path);
                                    return DownloadResult {
                                        success: false,
                                        path: None,
                                        error: Some(format!("Failed to create mod folder: {}", e)),
                                    };
                                }
                                
                                // Extract based on file type
                                if file_type == "zip" {
                                    if let Err(e) = extract_zip(&download_path, &mod_folder) {
                                        let _ = std::fs::remove_file(&download_path);
                                        println!("[MOD-DOWNLOAD] ZIP extraction failed: {}", e);
                                        continue;
                                    }
                                } else {
                                    // .fantome is also a ZIP file, extract the same way
                                    if let Err(e) = extract_zip(&download_path, &mod_folder) {
                                        let _ = std::fs::remove_file(&download_path);
                                        println!("[MOD-DOWNLOAD] FANTOME extraction failed: {}", e);
                                        continue;
                                    }
                                }
                                
                                // Clean up downloaded file
                                let _ = std::fs::remove_file(&download_path);
                                
                                return DownloadResult {
                                    success: true,
                                    path: Some(mod_folder.to_string_lossy().to_string()),
                                    error: None,
                                };
                            }
                            Err(e) => println!("[MOD-DOWNLOAD] Failed to read response: {}", e),
                        }
                    } else {
                        let status = response.status().as_u16();
                        println!("[MOD-DOWNLOAD] HTTP {} for {}", status, file_type);
                        
                        if status == 404 {
                            // File not found, try next format
                            break;
                        }
                    }
                }
                Err(e) => println!("[MOD-DOWNLOAD] Request failed: {}", e),
            }
            
            if attempts < max_attempts {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }
    }
    
    // Both .zip and .fantome failed - return user-friendly error
    DownloadResult {
        success: false,
        path: None,
        error: Some("SKIN_NOT_FOUND".to_string()),
    }
}


// [COMMAND] Activate mods using mod-tools.exe
// [SIMPLE-CACHE] Import once, reuse always - no hash files
#[tauri::command]
pub async fn activate_mods(mods: Vec<ModItem>, game_path: String) -> ActivationResult {
    println!("[MOD-ACTIVATE] Starting activation for {} mods", mods.len());
    println!("[MOD-ACTIVATE] Game path: {}", game_path);
    
    // Find managers directory
    let managers_dir = match get_managers_directory() {
        Some(dir) => dir,
        None => {
            return ActivationResult {
                success: false,
                message: String::new(),
                error: Some("managers directory not found - mod-tools.exe missing".to_string()),
                vanguard_blocked: false,
            };
        }
    };
    
    let mod_tools = managers_dir.join("mod-tools.exe");
    println!("[MOD-ACTIVATE] Using mod-tools: {:?}", mod_tools);
    
    // Create directories - preserve everything, NEVER delete
    let overlay_dir = get_overlay_directory();
    let installed_dir = overlay_dir.join("installed");
    let profile_dir = overlay_dir.join("profile");
    
    // [PERSISTENT] Create directories if not exist
    std::fs::create_dir_all(&installed_dir).ok();
    std::fs::create_dir_all(&profile_dir).ok();
    println!("[MOD-ACTIVATE] Using overlay directory: {:?}", overlay_dir);
    
    // Import each mod - skip if already in installed cache
    let game_arg = format!("--game:{}", game_path);
    
    // [CACHE] Build map of existing installed mods
    let mut existing_mods: std::collections::HashMap<String, PathBuf> = std::collections::HashMap::new();
    let mut duplicate_folders: Vec<PathBuf> = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(&installed_dir) {
        // [DUPLICATE-DETECTION] Track all mods and find duplicates
        let mut base_name_map: std::collections::HashMap<String, Vec<(String, PathBuf)>> = std::collections::HashMap::new();
        
        for entry in entries.filter_map(|e| e.ok()) {
            let dir_name = entry.file_name().to_string_lossy().to_string();
            let meta_path = entry.path().join("META").join("info.json");
            
            if meta_path.exists() || entry.path().join("WAD").exists() {
                // Extract base name (e.g., "103_103085" from "mod_0_103_103085")
                let base_name = if let Some(captures) = dir_name.strip_prefix("mod_") {
                    // Format: mod_X_baseName -> extract baseName
                    if let Some(idx) = captures.find('_') {
                        captures[idx + 1..].to_string()
                    } else {
                        dir_name.clone()
                    }
                } else {
                    dir_name.clone()
                };
                
                base_name_map
                    .entry(base_name)
                    .or_insert_with(Vec::new)
                    .push((dir_name.clone(), entry.path()));
                    
                existing_mods.insert(dir_name.clone(), entry.path());
                println!("[MOD-CACHE] Found cached: {}", dir_name);
            } else if dir_name.starts_with("temp_") {
                // [CLEANUP] Remove leftover temp folders from failed operations
                println!("[MOD-CACHE] Cleaning temp folder: {}", dir_name);
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
        
        // [DUPLICATE-CLEANUP] Remove duplicate mods (keep first occurrence)
        for (base_name, folders) in base_name_map.iter() {
            if folders.len() > 1 {
                println!("[MOD-CACHE] Found {} duplicates for {}", folders.len(), base_name);
                // Keep first, mark others for deletion
                for (_, path) in folders.iter().skip(1) {
                    duplicate_folders.push(path.clone());
                }
            }
        }
    }
    
    // [DUPLICATE-REMOVAL] Delete duplicate folders to prevent crashes
    if !duplicate_folders.is_empty() {
        println!("[MOD-CACHE] Removing {} duplicate mod folders", duplicate_folders.len());
        for folder in &duplicate_folders {
            if let Err(e) = std::fs::remove_dir_all(folder) {
                println!("[MOD-CACHE] WARN: Failed to remove duplicate: {:?} - {}", folder, e);
            } else {
                println!("[MOD-CACHE] Removed duplicate: {:?}", folder);
                // Remove from existing_mods map
                if let Some(name) = folder.file_name() {
                    existing_mods.remove(&name.to_string_lossy().to_string());
                }
            }
        }
    }
    
    println!("[MOD-CACHE] {} mods in cache (after cleanup)", existing_mods.len());
    
    // Track which mods we're using this session
    let mut session_mods: Vec<String> = Vec::new();
    
    for (_index, mod_item) in mods.iter().enumerate() {
        let src_path = PathBuf::from(&mod_item.path);
        
        // [LANGUAGE-INDEPENDENT] Use source path to generate unique mod name
        // This ensures same skin uses same cache regardless of UI language
        // Extract champion_skin ID from path like "103_103085" or use hash
        let mod_name = if let Some(file_name) = src_path.file_name() {
            let name_str = file_name.to_string_lossy().to_string();
            
            // [MARKETPLACE-FIX] Check if this is a marketplace mod
            // Detection methods (Windows uses \ and Unix uses /):
            // 1. Path contains "marketplace" directory (case-insensitive for safety)
            // 2. File name is "mod.fantome" (standard marketplace format)
            // 3. Parent directory name is the mod_id (UUID or custom ID)
            let path_str_lower = src_path.to_string_lossy().to_lowercase();
            let is_marketplace_mod = (path_str_lower.contains("marketplace") || 
                                      path_str_lower.contains("\\marketplace\\") ||
                                      path_str_lower.contains("/marketplace/"))
                && name_str == "mod.fantome";
            
            println!("[MOD-NAME] Processing: {} | Path: {} | IsMarketplace: {}", 
                     mod_item.name, src_path.display(), is_marketplace_mod);
            
            if is_marketplace_mod {
                // [MARKETPLACE] Extract mod_id from parent directory
                // Path: .../marketplace/{mod_id}/mod.fantome -> use {mod_id}
                if let Some(parent) = src_path.parent() {
                    if let Some(mod_id) = parent.file_name() {
                        let mod_id_str = mod_id.to_string_lossy().to_string();
                        // Validate mod_id is not empty and not "marketplace"
                        if !mod_id_str.is_empty() && mod_id_str.to_lowercase() != "marketplace" {
                            let marketplace_name = format!("marketplace_{}", mod_id_str);
                            println!("[MOD-NAME] Marketplace mod detected: {} (from path)", marketplace_name);
                            marketplace_name
                        } else {
                            // Fallback: use sanitized mod item name
                            let fallback_name = format!("marketplace_{}", mod_item.name
                                .chars()
                                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                                .collect::<String>());
                            println!("[MOD-NAME] Marketplace mod fallback: {} (from name)", fallback_name);
                            fallback_name
                        }
                    } else {
                        // Fallback: use mod item name
                        let fallback_name = format!("marketplace_{}", mod_item.name
                            .chars()
                            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                            .collect::<String>());
                        println!("[MOD-NAME] Marketplace mod fallback: {} (no parent filename)", fallback_name);
                        fallback_name
                    }
                } else {
                    let fallback_name = format!("marketplace_{}", mod_item.name
                        .chars()
                        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                        .collect::<String>());
                    println!("[MOD-NAME] Marketplace mod fallback: {} (no parent)", fallback_name);
                    fallback_name
                }
            } else {
                // [CUSTOM-MOD] Remove file extension for custom mods (.fantome, .zip, etc.)
                let name_without_ext = if name_str.contains('.') {
                    // Remove extension(s) like .fantome or .wad.client
                    let parts: Vec<&str> = name_str.split('.').collect();
                    if parts.len() > 1 {
                        // Keep only the base name before first dot
                        parts[0].to_string()
                    } else {
                        name_str.clone()
                    }
                } else {
                    name_str.clone()
                };
                
                // If path contains champion_skin format, use it directly
                if name_without_ext.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                    // Already in ID format (e.g., "103_103085" or "103_103085_chroma_103090")
                    println!("[MOD-NAME] Skin mod: {}", name_without_ext);
                    name_without_ext
                } else {
                    // Custom mod - use sanitized name (preserve original structure)
                    let custom_name = name_without_ext
                        .chars()
                        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
                        .collect::<String>()
                        .replace(' ', "_");
                    println!("[MOD-NAME] Custom mod: {}", custom_name);
                    custom_name
                }
            }
        } else {
            // Fallback: generate from mod name but sanitize heavily
            let fallback = mod_item.name
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .collect::<String>();
            println!("[MOD-NAME] Fallback (no filename): {}", fallback);
            fallback
        };
        
        // Ensure we have a valid name
        let mod_name = if mod_name.is_empty() {
            format!("mod_{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0))
        } else {
            mod_name
        };
        
        let target_dir = installed_dir.join(&mod_name);
        
        // [CACHE-CHECK] If mod already exists with valid content, REUSE it (no re-import)
        if target_dir.exists() {
            let has_wad = target_dir.join("WAD").exists();
            let has_meta = target_dir.join("META").exists();
            
            if has_wad || has_meta {
                println!("[MOD-CACHE] Cache HIT - reusing: {}", mod_name);
                session_mods.push(mod_name);
                continue;  // Skip import entirely
            }
        }
        
        // [CACHE-MISS] Need to import this mod
        if !src_path.exists() {
            println!("[MOD-ACTIVATE] WARN: Source not found: {:?}", src_path);
            println!("[MOD-ACTIVATE] DEBUG: Checking path components...");
            println!("[MOD-ACTIVATE] DEBUG: Path string: {}", mod_item.path);
            println!("[MOD-ACTIVATE] DEBUG: Canonicalized attempt...");
            if let Ok(canonical) = std::fs::canonicalize(&src_path) {
                println!("[MOD-ACTIVATE] DEBUG: Canonical path: {:?}", canonical);
            } else {
                println!("[MOD-ACTIVATE] DEBUG: Cannot canonicalize - file truly missing");
            }
            // [FALLBACK] Try alternative path formats for Windows
            let alt_path = PathBuf::from(mod_item.path.replace("/", "\\"));
            if alt_path.exists() {
                println!("[MOD-ACTIVATE] DEBUG: Alternative path exists: {:?}", alt_path);
            }
            continue;
        }
        
        println!("[MOD-CACHE] Cache MISS - importing: {}", mod_name);
        
        // [CLEAN] Only remove if exists but invalid (no WAD/META)
        if target_dir.exists() {
            let _ = std::fs::remove_dir_all(&target_dir);
        }
        
        // Copy or import the mod
        if src_path.is_dir() {
            println!("[MOD-ACTIVATE] Copying: {} -> {}", src_path.display(), mod_name);
            if let Err(e) = copy_dir_recursive(&src_path, &target_dir) {
                println!("[MOD-ACTIVATE] WARN: Copy failed: {}", e);
                continue;
            }
            session_mods.push(mod_name);
        } else if src_path.is_file() {
            println!("[MOD-ACTIVATE] Importing: {} -> {}", src_path.display(), mod_name);
            
            let mut cmd = Command::new(&mod_tools);
            cmd.args(&[
                "import",
                src_path.to_str().unwrap_or(""),
                target_dir.to_str().unwrap_or(""),
                &game_arg,
            ]);
            
            // [WINDOWS] Hide console window
            #[cfg(windows)]
            cmd.creation_flags(CREATE_NO_WINDOW);
            
            let import_result = cmd.output();
            
            match import_result {
                Ok(output) => {
                    if output.status.success() {
                        println!("[MOD-ACTIVATE] Imported: {}", mod_name);
                        session_mods.push(mod_name);
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        println!("[MOD-ACTIVATE] WARN: Import failed: {}", stderr);
                    }
                }
                Err(e) => println!("[MOD-ACTIVATE] WARN: Import error: {}", e),
            }
        }
    }
    
    // Use session mods for this activation
    let imported_mods = session_mods;
    
    if imported_mods.is_empty() {
        return ActivationResult {
            success: false,
            message: String::new(),
            error: Some("No valid mods to activate".to_string()),
            vanguard_blocked: false,
        };
    }
    
    // Build mkoverlay command
    let mods_arg = format!("--mods:{}", imported_mods.join("/"));
    
    println!("[MOD-ACTIVATE] Running mkoverlay...");
    println!("[MOD-ACTIVATE] Installed dir: {:?}", installed_dir);
    println!("[MOD-ACTIVATE] Profile dir: {:?}", profile_dir);
    println!("[MOD-ACTIVATE] Mods: {}", mods_arg);
    
    // [NOTE] Profile directory is NOT deleted - mkoverlay overwrites existing files
    // This preserves cache and speeds up re-activation with same/similar mods
    
    // [RETRY-MECHANISM] Try mkoverlay up to 3 times (bocchi-style crash prevention)
    let mut mkoverlay_success = false;
    let mut last_error: Option<String> = None;
    let mut is_vanguard_blocked = false;
    
    for attempt in 1..=3 {
        if attempt > 1 {
            println!("[MOD-ACTIVATE] Retrying mkoverlay, attempt {}/3", attempt);
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        
        let mut cmd = Command::new(&mod_tools);
        cmd.args(&[
            "mkoverlay",
            installed_dir.to_str().unwrap_or(""),
            profile_dir.to_str().unwrap_or(""),
            &game_arg,
            &mods_arg,
            "--noTFT",           // [CRASH-FIX] Skip TFT files to prevent crashes
            "--ignoreConflict"   // [CRASH-FIX] Ignore mod conflicts
        ]);
        
        // [WINDOWS] Hide console window
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        let mkoverlay_result = cmd.output();
        
        match mkoverlay_result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                println!("[MOD-ACTIVATE] mkoverlay stdout: {}", stdout);
                println!("[MOD-ACTIVATE] mkoverlay stderr: {}", stderr);
                
                if output.status.success() {
                    println!("[MOD-ACTIVATE] mkoverlay completed successfully on attempt {}", attempt);
                    mkoverlay_success = true;
                    break;
                } else {
                    is_vanguard_blocked = stderr.contains("C0000229") || stderr.contains("ah_result");
                    last_error = Some(format!("mkoverlay failed: {}", stderr));
                    println!("[MOD-ACTIVATE] mkoverlay attempt {} failed: {}", attempt, stderr);
                }
            }
            Err(e) => {
                last_error = Some(format!("Failed to run mkoverlay: {}", e));
                println!("[MOD-ACTIVATE] mkoverlay attempt {} error: {}", attempt, e);
            }
        }
    }
    
    if !mkoverlay_success {
        return ActivationResult {
            success: false,
            message: String::new(),
            error: last_error,
            vanguard_blocked: is_vanguard_blocked,
        };
    }
    
    println!("[MOD-ACTIVATE] Profile ready - starting overlay");
    
    // Start overlay process
    start_overlay_process(&mod_tools, &overlay_dir, &profile_dir, &game_path, imported_mods.len())
}

// [FUNC] Start overlay process - extracted for reuse
fn start_overlay_process(
    mod_tools: &PathBuf,
    overlay_dir: &PathBuf,
    profile_dir: &PathBuf,
    game_path: &str,
    mod_count: usize
) -> ActivationResult {
    let game_arg = format!("--game:{}", game_path);
    let config_path = overlay_dir.join("profile.config");
    let status_file = overlay_dir.join("overlay.status");
    
    // [DEBUG] Log profile directory contents
    println!("[MOD-ACTIVATE] Checking profile directory contents...");
    if let Ok(entries) = std::fs::read_dir(profile_dir) {
        let files: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        println!("[MOD-ACTIVATE] Profile contains {} items:", files.len());
        for entry in files.iter().take(10) {
            let path = entry.path();
            let size = if path.is_file() {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            } else {
                0
            };
            println!("[MOD-ACTIVATE]   - {} ({} bytes)", 
                     entry.file_name().to_string_lossy(), size);
        }
        if files.len() > 10 {
            println!("[MOD-ACTIVATE]   ... and {} more", files.len() - 10);
        }
    } else {
        println!("[MOD-ACTIVATE] WARN: Cannot read profile directory!");
    }
    
    // Create config file for runoverlay (empty file as bocchi does)
    std::fs::write(&config_path, "").ok();
    
    // Mark overlay as ready
    std::fs::write(&status_file, "ready").ok();
    
    // [DLL-CHECK] Verify DLL exists before starting overlay
    let managers_dir = mod_tools.parent().map(|p| p.to_path_buf());
    if let Some(ref mgr_dir) = managers_dir {
        if let Err(e) = verify_dll_exists(mgr_dir) {
            println!("[MOD-ACTIVATE] WARN: DLL check failed: {} - continuing anyway", e);
        }
    }
    
    println!("[MOD-ACTIVATE] Starting runoverlay process...");
    println!("[MOD-ACTIVATE] mod-tools path: {:?}", mod_tools);
    println!("[MOD-ACTIVATE] Profile dir: {:?}", profile_dir);
    println!("[MOD-ACTIVATE] Config path: {:?}", config_path);
    println!("[MOD-ACTIVATE] Game arg: {}", game_arg);
    
    // [SPAWN] Start the overlay process with proper configuration
    let mut cmd = Command::new(mod_tools);
    cmd.args(&[
        "runoverlay",
        profile_dir.to_str().unwrap_or(""),
        config_path.to_str().unwrap_or(""),
        &game_arg,
        "--opts:none"
    ])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
    
    // [WINDOWS] Hide console window
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let runoverlay_result = cmd.spawn();
    
    match runoverlay_result {
        Ok(mut child) => {
            let pid = child.id();
            println!("[MOD-ACTIVATE] Overlay process spawned with PID: {}", pid);
            
            // [VERIFY] Wait briefly and check if process is still running
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            match child.try_wait() {
                Ok(Some(status)) => {
                    // Process exited immediately - this is the problem!
                    println!("[MOD-ACTIVATE] ERROR: Process exited immediately with status: {:?}", status);
                    
                    // Try to capture any output
                    if let Some(mut stdout) = child.stdout.take() {
                        let mut output = String::new();
                        let _ = stdout.read_to_string(&mut output);
                        if !output.is_empty() {
                            println!("[MOD-ACTIVATE] stdout: {}", output);
                        }
                    }
                    if let Some(mut stderr) = child.stderr.take() {
                        let mut output = String::new();
                        let _ = stderr.read_to_string(&mut output);
                        if !output.is_empty() {
                            println!("[MOD-ACTIVATE] stderr: {}", output);
                        }
                    }
                    
                    // Check for Vanguard-related exit codes
                    let exit_code = status.code().unwrap_or(-1);
                    let is_vanguard = exit_code == -1073741511 || exit_code == -1073740791; // C0000135 or C0000229
                    
                    return ActivationResult {
                        success: false,
                        message: String::new(),
                        error: Some(format!("Overlay process exited immediately (code: {})", exit_code)),
                        vanguard_blocked: is_vanguard,
                    };
                }
                Ok(None) => {
                    // Process is still running - good!
                    println!("[MOD-ACTIVATE] Overlay process is running (PID: {})", pid);
                }
                Err(e) => {
                    println!("[MOD-ACTIVATE] WARN: Could not check process status: {}", e);
                }
            }
            
            // Save PID for tracking
            let pid_file = overlay_dir.join("overlay.pid");
            std::fs::write(&pid_file, pid.to_string()).ok();
            
            // Update status to running
            std::fs::write(&status_file, "running").ok();
            
            // [CRITICAL] Store process in global state to keep it alive
            if let Ok(mut guard) = OVERLAY_PROCESS.lock() {
                if let Some(mut old_process) = guard.take() {
                    let _ = old_process.kill();
                }
                *guard = Some(child);
                println!("[MOD-ACTIVATE] Process stored in global state");
            }
            
            ActivationResult {
                success: true,
                message: format!("Overlay active - {} mods loaded", mod_count),
                error: None,
                vanguard_blocked: false,
            }
        }
        Err(e) => {
            println!("[MOD-ACTIVATE] WARN: runoverlay spawn failed: {}", e);
            ActivationResult {
                success: false,
                message: String::new(),
                error: Some(format!("Failed to start overlay: {}", e)),
                vanguard_blocked: false,
            }
        }
    }
}

// [FUNC] Recursively copy directory
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create dir: {}", e))?;
    
    let entries = std::fs::read_dir(src)
        .map_err(|e| format!("Failed to read dir: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    
    Ok(())
}

// [FUNC] Get game path config file location
fn get_game_path_config() -> PathBuf {
    let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    app_data.join("Wildflover").join("game_path.txt")
}

// [COMMAND] Get League of Legends game path - checks saved path first
#[tauri::command]
pub async fn detect_game_path() -> Option<String> {
    // [PRIORITY-1] Check saved manual path first
    let config_path = get_game_path_config();
    if config_path.exists() {
        if let Ok(saved_path) = std::fs::read_to_string(&config_path) {
            let saved_path = saved_path.trim().to_string();
            let game_exe = PathBuf::from(&saved_path).join("League of Legends.exe");
            if game_exe.exists() {
                println!("[MOD-DETECT] Using saved game path: {}", saved_path);
                return Some(saved_path);
            } else {
                println!("[MOD-DETECT] Saved path invalid, removing config");
                let _ = std::fs::remove_file(&config_path);
            }
        }
    }
    
    // [PRIORITY-2] Auto-detect from common paths
    let common_paths = vec![
        "C:\\Riot Games\\League of Legends\\Game",
        "D:\\Riot Games\\League of Legends\\Game",
        "C:\\Program Files\\Riot Games\\League of Legends\\Game",
        "C:\\Program Files (x86)\\Riot Games\\League of Legends\\Game",
        "E:\\Riot Games\\League of Legends\\Game",
        "F:\\Riot Games\\League of Legends\\Game",
    ];
    
    for path in common_paths {
        let game_exe = PathBuf::from(path).join("League of Legends.exe");
        if game_exe.exists() {
            println!("[MOD-DETECT] Found game at: {}", path);
            return Some(path.to_string());
        }
    }
    
    println!("[MOD-DETECT] Game path not found automatically");
    None
}

// [COMMAND] Set game path manually - saves to config file
#[tauri::command]
pub async fn set_game_path(path: String) -> Result<bool, String> {
    let game_exe = PathBuf::from(&path).join("League of Legends.exe");
    
    if !game_exe.exists() {
        println!("[MOD-PATH] Invalid path - League of Legends.exe not found: {}", path);
        return Err("League of Legends.exe not found in selected folder".to_string());
    }
    
    let config_path = get_game_path_config();
    
    // Create parent directory if needed
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    
    // Save path to config file
    std::fs::write(&config_path, &path)
        .map_err(|e| format!("Failed to save game path: {}", e))?;
    
    println!("[MOD-PATH] Game path saved: {}", path);
    Ok(true)
}

// [TYPES] Browse result for detailed response
#[derive(serde::Serialize)]
pub struct BrowseResult {
    pub success: bool,
    pub path: Option<String>,
    pub cancelled: bool,
    pub error: Option<String>,
}

// [COMMAND] Browse for game executable using native dialog
#[tauri::command]
pub async fn browse_game_path() -> BrowseResult {
    println!("[MOD-PATH] Opening file browser for League of Legends.exe...");
    
    // Try to set initial directory to common LoL installation paths
    let mut dialog = rfd::FileDialog::new()
        .set_title("Select League of Legends.exe (Game folder)")
        .add_filter("League of Legends", &["exe"])
        .set_file_name("League of Legends.exe");
    
    // Check common installation paths and set as starting directory
    let common_paths = [
        "C:\\Riot Games\\League of Legends\\Game",
        "D:\\Riot Games\\League of Legends\\Game",
        "C:\\Program Files\\Riot Games\\League of Legends\\Game",
        "C:\\Program Files (x86)\\Riot Games\\League of Legends\\Game",
    ];
    
    for path in common_paths.iter() {
        let game_dir = std::path::Path::new(path);
        if game_dir.exists() {
            dialog = dialog.set_directory(game_dir);
            println!("[MOD-PATH] Set initial directory: {}", path);
            break;
        }
    }
    
    let dialog = dialog.pick_file();
    
    match dialog {
        Some(path) => {
            let file_name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let file_name_lower = file_name.to_lowercase();
            
            // Verify it's the correct executable (League of Legends.exe)
            if file_name_lower == "league of legends.exe" {
                // Return parent directory (Game folder)
                if let Some(parent) = path.parent() {
                    let game_path = parent.to_string_lossy().to_string();
                    println!("[MOD-PATH] Valid game executable selected: {}", game_path);
                    return BrowseResult {
                        success: true,
                        path: Some(game_path),
                        cancelled: false,
                        error: None,
                    };
                }
            }
            
            // Invalid file selected - not League of Legends.exe
            println!("[MOD-PATH] Invalid file selected: {} (expected: League of Legends.exe)", file_name);
            BrowseResult {
                success: false,
                path: None,
                cancelled: false,
                error: Some(format!("Invalid file: {}. Please select League of Legends.exe", file_name)),
            }
        }
        None => {
            println!("[MOD-PATH] File browser cancelled");
            BrowseResult {
                success: false,
                path: None,
                cancelled: true,
                error: None,
            }
        }
    }
}

// [COMMAND] Clear saved game path - revert to auto-detect
#[tauri::command]
pub async fn clear_game_path() -> bool {
    let config_path = get_game_path_config();
    
    if config_path.exists() {
        if let Err(e) = std::fs::remove_file(&config_path) {
            println!("[MOD-PATH] Failed to clear game path: {}", e);
            return false;
        }
        println!("[MOD-PATH] Game path cleared - will use auto-detect");
    }
    
    true
}

// [COMMAND] Clean up overlay and temporary files
#[tauri::command]
pub async fn cleanup_overlay() -> bool {
    let overlay_dir = get_overlay_directory();
    
    if overlay_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&overlay_dir) {
            println!("[MOD-CLEANUP] Failed to cleanup: {}", e);
            return false;
        }
        println!("[MOD-CLEANUP] Overlay cleaned up successfully");
    }
    
    true
}

// [STRUCT] Cache file information
#[derive(serde::Serialize)]
pub struct CacheFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

// [STRUCT] Full cache information
#[derive(serde::Serialize)]
pub struct CacheInfo {
    pub path: String,
    pub total_size: u64,
    pub file_count: usize,
    pub files: Vec<CacheFileInfo>,
}

// [COMMAND] Clear installed mods cache - for manual cache clearing
#[tauri::command]
pub async fn clear_mods_cache() -> bool {
    let overlay_dir = get_overlay_directory();
    let mods_dir = get_mods_directory();
    let installed_dir = overlay_dir.join("installed");
    let profile_dir = overlay_dir.join("profile");
    
    let mut success = true;
    
    // Clear downloaded mods directory
    if mods_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&mods_dir) {
            println!("[MOD-CACHE] Failed to clear mods cache: {}", e);
            success = false;
        } else {
            println!("[MOD-CACHE] Downloaded mods cache cleared successfully");
        }
    }
    
    // Clear installed directory
    if installed_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&installed_dir) {
            println!("[MOD-CACHE] Failed to clear installed cache: {}", e);
            success = false;
        } else {
            println!("[MOD-CACHE] Installed mods cache cleared successfully");
        }
    }
    
    // Clear profile/overlay directory
    if profile_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&profile_dir) {
            println!("[MOD-CACHE] Failed to clear profile cache: {}", e);
            success = false;
        } else {
            println!("[MOD-CACHE] Profile cache cleared successfully");
        }
    }
    
    // Clear selection hash file
    let cache_file = overlay_dir.join("selection.hash");
    if cache_file.exists() {
        let _ = std::fs::remove_file(&cache_file);
    }
    
    // Clear status files
    let status_file = overlay_dir.join("overlay.status");
    let pid_file = overlay_dir.join("overlay.pid");
    if status_file.exists() { let _ = std::fs::remove_file(&status_file); }
    if pid_file.exists() { let _ = std::fs::remove_file(&pid_file); }
    
    println!("[MOD-CACHE] Full cache cleanup completed");
    success
}

// [COMMAND] Clear cache - alias for frontend
#[tauri::command]
pub async fn clear_cache() -> bool {
    clear_mods_cache().await
}

// [COMMAND] Delete single cache file
#[tauri::command]
pub async fn delete_cache_file(path: String) -> bool {
    let file_path = std::path::PathBuf::from(&path);
    
    if file_path.exists() {
        if file_path.is_dir() {
            if let Err(e) = std::fs::remove_dir_all(&file_path) {
                println!("[MOD-CACHE] Failed to delete directory: {}", e);
                return false;
            }
        } else {
            if let Err(e) = std::fs::remove_file(&file_path) {
                println!("[MOD-CACHE] Failed to delete file: {}", e);
                return false;
            }
        }
        println!("[MOD-CACHE] Deleted: {}", path);
        return true;
    }
    
    false
}

// [COMMAND] Get detailed cache info for frontend - includes mods + installed + overlay folders
#[tauri::command]
pub async fn get_cache_info() -> CacheInfo {
    let overlay_dir = get_overlay_directory();
    let mods_dir = get_mods_directory();
    let installed_dir = overlay_dir.join("installed");
    let profile_dir = overlay_dir.join("profile");
    
    // Use parent Wildflover directory as main path
    let app_data = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    let wildflover_dir = app_data.join("Wildflover");
    
    let mut cache_info = CacheInfo {
        path: wildflover_dir.to_string_lossy().to_string(),
        total_size: 0,
        file_count: 0,
        files: Vec::new(),
    };
    
    // [SCAN] Helper function to scan a directory and add to cache info
    let scan_directory = |dir: &PathBuf, files: &mut Vec<CacheFileInfo>, total_size: &mut u64, file_count: &mut usize, prefix: &str| {
        if !dir.exists() {
            return;
        }
        
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let raw_name = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                // Add prefix to distinguish source folder
                let name = if prefix.is_empty() {
                    raw_name
                } else {
                    format!("[{}] {}", prefix, raw_name)
                };
                
                let (size, modified) = if path.is_dir() {
                    let dir_size = calculate_dir_size(&path).unwrap_or(0);
                    let mod_time = entry.metadata()
                        .and_then(|m| m.modified())
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                        .unwrap_or(0);
                    (dir_size, mod_time)
                } else {
                    let meta = entry.metadata().ok();
                    let file_size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let mod_time = meta
                        .and_then(|m| m.modified().ok())
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                        .unwrap_or(0);
                    (file_size, mod_time)
                };
                
                *total_size += size;
                *file_count += 1;
                files.push(CacheFileInfo {
                    name,
                    path: path.to_string_lossy().to_string(),
                    size,
                    modified,
                });
            }
        }
    };
    
    // [SCAN] Scan downloaded mods directory
    scan_directory(
        &mods_dir, 
        &mut cache_info.files, 
        &mut cache_info.total_size, 
        &mut cache_info.file_count,
        "mods"
    );
    
    // [SCAN] Scan installed directory (main cache)
    scan_directory(
        &installed_dir, 
        &mut cache_info.files, 
        &mut cache_info.total_size, 
        &mut cache_info.file_count,
        "installed"
    );
    
    // [SCAN] Scan profile/overlay directory
    scan_directory(
        &profile_dir, 
        &mut cache_info.files, 
        &mut cache_info.total_size, 
        &mut cache_info.file_count,
        "overlay"
    );
    
    // Sort by modified time (newest first)
    cache_info.files.sort_by(|a, b| b.modified.cmp(&a.modified));
    
    println!("[MOD-CACHE] Cache info: {} files, {} MB (mods + installed + overlay)", 
        cache_info.file_count, 
        cache_info.total_size / 1024 / 1024
    );
    
    cache_info
}

// [FUNC] Calculate directory size recursively
fn calculate_dir_size(path: &PathBuf) -> Result<u64, std::io::Error> {
    let mut size = 0;
    
    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                size += calculate_dir_size(&path)?;
            } else {
                size += entry.metadata()?.len();
            }
        }
    }
    
    Ok(size)
}

// [COMMAND] Stop/deactivate overlay - bocchi-style graceful shutdown
// NOTE: Does NOT delete any files - only stops the process
#[tauri::command]
pub async fn stop_overlay() -> ActivationResult {
    println!("[MOD-STOP] Deactivating overlay...");
    
    let overlay_dir = get_overlay_directory();
    
    // [BOCCHI-STYLE] First try graceful shutdown via stdin
    if let Ok(mut guard) = OVERLAY_PROCESS.lock() {
        if let Some(ref mut process) = *guard {
            println!("[MOD-STOP] Attempting graceful shutdown via stdin...");
            
            // Write newline to stdin for graceful shutdown (bocchi method)
            if let Some(ref mut stdin) = process.stdin {
                let _ = stdin.write_all(b"\n");
                let _ = stdin.flush();
            }
            
            // Wait a bit for graceful shutdown
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            // Check if still running, force kill if needed
            match process.try_wait() {
                Ok(Some(status)) => {
                    println!("[MOD-STOP] Process exited gracefully with status: {:?}", status);
                }
                Ok(None) => {
                    println!("[MOD-STOP] Process still running, force killing...");
                    let _ = process.kill();
                }
                Err(e) => {
                    println!("[MOD-STOP] Error checking process: {}", e);
                    let _ = process.kill();
                }
            }
        }
        *guard = None;
    }
    
    // Force kill any remaining mod-tools.exe processes
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(&["/F", "/IM", "mod-tools.exe"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        let _ = cmd.output();
        println!("[MOD-STOP] Killed remaining mod-tools.exe processes");
    }
    
    // Update status file only - NO file deletion
    let status_file = overlay_dir.join("overlay.status");
    std::fs::write(&status_file, "stopped").ok();
    
    println!("[MOD-STOP] Overlay stopped - all files preserved for instant restart");
    
    ActivationResult {
        success: true,
        message: "Overlay deactivated".to_string(),
        error: None,
        vanguard_blocked: false,
    }
}

// [COMMAND] Check if overlay is currently ready/active
#[tauri::command]
pub async fn is_overlay_running() -> bool {
    // [PRIORITY] First check global process state
    if let Ok(guard) = OVERLAY_PROCESS.lock() {
        if let Some(ref process) = *guard {
            // Check if process is still alive
            let pid = process.id();
            
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                
                let check = Command::new("tasklist")
                    .args(&["/FI", &format!("PID eq {}", pid), "/NH"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
                
                if let Ok(output) = check {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if stdout.contains("mod-tools.exe") {
                        println!("[MOD-STATUS] Overlay is RUNNING (PID {} in global state)", pid);
                        return true;
                    }
                }
            }
            
            #[cfg(not(windows))]
            {
                // On non-Windows, just check if we have a process
                println!("[MOD-STATUS] Overlay process exists in global state (PID {})", pid);
                return true;
            }
        }
    }
    
    // Fallback: Check status file and tasklist
    let overlay_dir = get_overlay_directory();
    let status_file = overlay_dir.join("overlay.status");
    
    if status_file.exists() {
        if let Ok(status) = std::fs::read_to_string(&status_file) {
            let status_val = status.trim();
            if status_val == "running" {
                // Verify mod-tools.exe is actually running
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    
                    let check = Command::new("tasklist")
                        .args(&["/FI", "IMAGENAME eq mod-tools.exe", "/NH"])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();
                    
                    if let Ok(output) = check {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        if stdout.contains("mod-tools.exe") {
                            println!("[MOD-STATUS] Overlay is RUNNING (mod-tools.exe found in tasklist)");
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    println!("[MOD-STATUS] Overlay is NOT running");
    false
}

// [COMMAND] Delete custom mod cache - removes from mods/ and installed/ directories
// Called when user deletes a custom mod from the UI
// Always returns true - card deletion succeeds even if no cache files exist
#[tauri::command]
pub async fn delete_custom_mod_cache(mod_name: String) -> bool {
    println!("[MOD-CACHE] Deleting custom mod cache: {}", mod_name);
    
    let mods_dir = get_mods_directory();
    let overlay_dir = get_overlay_directory();
    let installed_dir = overlay_dir.join("installed");
    
    // [SANITIZE] Generate the same cache name as used during import
    let sanitized_name: String = if mod_name.contains('.') {
        // Remove extension
        let parts: Vec<&str> = mod_name.split('.').collect();
        parts[0].to_string()
    } else {
        mod_name.clone()
    };
    
    let cache_name: String = sanitized_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
        .collect::<String>()
        .replace(' ', "_");
    
    let mut deleted_count = 0;
    
    // [DELETE] From mods/ directory (downloaded files) - skip if not exists
    let mods_path = mods_dir.join(&cache_name);
    if mods_path.exists() {
        if let Err(e) = std::fs::remove_dir_all(&mods_path) {
            println!("[MOD-CACHE] WARN: Failed to delete from mods/: {}", e);
        } else {
            println!("[MOD-CACHE] Deleted from mods/: {}", cache_name);
            deleted_count += 1;
        }
    } else {
        println!("[MOD-CACHE] No cache in mods/ for: {}", cache_name);
    }
    
    // [DELETE] From installed/ directory (extracted/imported files) - skip if not exists
    let installed_path = installed_dir.join(&cache_name);
    if installed_path.exists() {
        if let Err(e) = std::fs::remove_dir_all(&installed_path) {
            println!("[MOD-CACHE] WARN: Failed to delete from installed/: {}", e);
        } else {
            println!("[MOD-CACHE] Deleted from installed/: {}", cache_name);
            deleted_count += 1;
        }
    } else {
        println!("[MOD-CACHE] No cache in installed/ for: {}", cache_name);
    }
    
    // [MARKETPLACE-FIX] Also try marketplace_ prefixed name for marketplace mods
    // This handles cases where mod was imported from marketplace
    let marketplace_cache_name = format!("marketplace_{}", cache_name);
    let marketplace_installed_path = installed_dir.join(&marketplace_cache_name);
    if marketplace_installed_path.exists() {
        if let Err(e) = std::fs::remove_dir_all(&marketplace_installed_path) {
            println!("[MOD-CACHE] WARN: Failed to delete marketplace cache from installed/: {}", e);
        } else {
            println!("[MOD-CACHE] Deleted marketplace cache from installed/: {}", marketplace_cache_name);
            deleted_count += 1;
        }
    }
    
    // [INVALIDATE] Clear selection hash only if we deleted something
    if deleted_count > 0 {
        let cache_file = overlay_dir.join("selection.hash");
        if cache_file.exists() {
            let _ = std::fs::remove_file(&cache_file);
            println!("[MOD-CACHE] Selection hash invalidated");
        }
    }
    
    println!("[MOD-CACHE] Cache cleanup complete: {} items deleted", deleted_count);
    
    true
}

// [DIAGNOSTIC] System diagnostic information for troubleshooting
#[derive(serde::Serialize)]
pub struct SystemDiagnostic {
    pub managers_dir_found: bool,
    pub managers_dir_path: Option<String>,
    pub mod_tools_exists: bool,
    pub dll_exists: bool,
    pub dll_size: u64,
    pub game_path: Option<String>,
    pub overlay_status: String,
    pub cslol_version: Option<String>,
    pub profile_dir_exists: bool,
    pub profile_file_count: usize,
    pub installed_mod_count: usize,
}

// [COMMAND] Run system diagnostic - helps identify why mods aren't working
#[tauri::command]
pub async fn run_diagnostic() -> SystemDiagnostic {
    println!("[DIAGNOSTIC] Running system diagnostic...");
    
    let managers_dir = get_managers_directory();
    let overlay_dir = get_overlay_directory();
    let profile_dir = overlay_dir.join("profile");
    let installed_dir = overlay_dir.join("installed");
    
    let managers_dir_found = managers_dir.is_some();
    let managers_dir_path = managers_dir.as_ref().map(|p| p.to_string_lossy().to_string());
    
    let mod_tools_exists = managers_dir
        .as_ref()
        .map(|d| d.join("mod-tools.exe").exists())
        .unwrap_or(false);
    
    let dll_path = managers_dir.as_ref().map(|d| d.join(DLL_FILE_NAME));
    let dll_exists = dll_path.as_ref().map(|p| p.exists()).unwrap_or(false);
    let dll_size = dll_path
        .as_ref()
        .and_then(|p| std::fs::metadata(p).ok())
        .map(|m| m.len())
        .unwrap_or(0);
    
    let game_path = detect_game_path().await;
    
    let overlay_status = if let Ok(status) = std::fs::read_to_string(overlay_dir.join("overlay.status")) {
        status.trim().to_string()
    } else {
        "not_found".to_string()
    };
    
    let cslol_version = None; // DLL version tracking removed - using local DLL only
    
    let profile_dir_exists = profile_dir.exists();
    let profile_file_count = if profile_dir.exists() {
        std::fs::read_dir(&profile_dir)
            .map(|entries| entries.count())
            .unwrap_or(0)
    } else {
        0
    };
    
    let installed_mod_count = if installed_dir.exists() {
        std::fs::read_dir(&installed_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0)
    } else {
        0
    };
    
    let diagnostic = SystemDiagnostic {
        managers_dir_found,
        managers_dir_path,
        mod_tools_exists,
        dll_exists,
        dll_size,
        game_path,
        overlay_status,
        cslol_version,
        profile_dir_exists,
        profile_file_count,
        installed_mod_count,
    };
    
    println!("[DIAGNOSTIC] Results:");
    println!("[DIAGNOSTIC]   managers_dir: {:?}", diagnostic.managers_dir_path);
    println!("[DIAGNOSTIC]   mod_tools: {}", diagnostic.mod_tools_exists);
    println!("[DIAGNOSTIC]   dll: {} ({} bytes)", diagnostic.dll_exists, diagnostic.dll_size);
    println!("[DIAGNOSTIC]   game_path: {:?}", diagnostic.game_path);
    println!("[DIAGNOSTIC]   overlay_status: {}", diagnostic.overlay_status);
    println!("[DIAGNOSTIC]   cslol_version: {:?}", diagnostic.cslol_version);
    println!("[DIAGNOSTIC]   profile_files: {}", diagnostic.profile_file_count);
    println!("[DIAGNOSTIC]   installed_mods: {}", diagnostic.installed_mod_count);
    
    diagnostic
}

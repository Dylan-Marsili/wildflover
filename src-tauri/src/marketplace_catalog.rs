//! File: marketplace_catalog.rs
//! Author: Wildflover
//! Description: GitHub API response structures for marketplace operations
//!              - Blob, Tree, Commit, Ref response types
//!              - Used by marketplace.rs for Git API operations
//! Language: Rust

use serde::Deserialize;

// [STRUCT] GitHub blob response - returned after creating a blob
#[derive(Deserialize)]
pub struct GitHubBlobResponse {
    pub sha: String,
}

// [STRUCT] GitHub tree item for commit - defines file in tree
#[derive(serde::Serialize)]
pub struct GitHubTreeItem {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub sha: String,
}

// [STRUCT] GitHub tree response - returned after creating a tree
#[derive(Deserialize)]
pub struct GitHubTreeResponse {
    pub sha: String,
}

// [STRUCT] GitHub commit response - returned after creating a commit
#[derive(Deserialize)]
pub struct GitHubCommitResponse {
    pub sha: String,
    pub html_url: String,
}

// [STRUCT] GitHub ref response - returned when fetching branch reference
#[derive(Deserialize)]
pub struct GitHubRefResponse {
    pub object: GitHubRefObject,
}

// [STRUCT] GitHub ref object - contains SHA of the reference
#[derive(Deserialize)]
pub struct GitHubRefObject {
    pub sha: String,
}

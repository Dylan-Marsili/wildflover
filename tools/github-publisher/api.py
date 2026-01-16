"""
File: api.py
Author: Wildflover
Description: GitHub API client for repository operations
Language: Python 3.10+
"""

import base64
import requests
from typing import Optional, List, Dict, Any

from config import GITHUB_API_BASE, GITHUB_API_VERSION, MAX_FILE_SIZE_MB
from models import (
    RepoConfig, RepoResponse, BlobResponse, 
    TreeEntry, TreeResponse, CommitResponse
)
from utils import log_info, log_error, log_success, format_size


class GitHubAPIError(Exception):
    """Custom exception for GitHub API errors"""
    def __init__(self, message: str, status_code: int = 0):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class GitHubAPI:
    """GitHub REST API client"""
    
    def __init__(self, token: str):
        """Initialize API client with authentication token"""
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
            "User-Agent": "GitHub-Publisher/1.0"
        })
        self._user: Optional[str] = None
    
    @property
    def user(self) -> str:
        """Get authenticated username"""
        if not self._user:
            self._user = self.get_authenticated_user()
        return self._user
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make API request with error handling"""
        url = f"{GITHUB_API_BASE}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            if response.status_code >= 400:
                error_msg = response.json().get("message", "Unknown error")
                raise GitHubAPIError(error_msg, response.status_code)
            
            if response.status_code == 204:
                return {}
            
            return response.json()
            
        except requests.RequestException as e:
            raise GitHubAPIError(f"Network error: {str(e)}")
    
    def get_authenticated_user(self) -> str:
        """Get authenticated user's login name"""
        log_info("AUTH", "Verifying authentication...")
        data = self._request("GET", "/user")
        username = data.get("login", "")
        log_success("AUTH", f"Authenticated as: {username}")
        return username
    
    def check_repo_exists(self, repo_name: str) -> bool:
        """Check if repository already exists"""
        try:
            self._request("GET", f"/repos/{self.user}/{repo_name}")
            return True
        except GitHubAPIError as e:
            if e.status_code == 404:
                return False
            raise
    
    def create_repository(self, config: RepoConfig) -> RepoResponse:
        """Create new repository with initial commit"""
        log_info("REPO-CREATE", f"Creating repository: {config.name}")
        
        payload = {
            "name": config.name,
            "description": config.description,
            "private": config.visibility.value == "private",
            "has_issues": config.has_issues,
            "has_wiki": config.has_wiki,
            "has_projects": config.has_projects,
            "auto_init": True  # Create with README to initialize repo
        }
        
        if config.homepage:
            payload["homepage"] = config.homepage
        
        data = self._request("POST", "/user/repos", json=payload)
        
        repo = RepoResponse(
            id=data["id"],
            name=data["name"],
            full_name=data["full_name"],
            html_url=data["html_url"],
            clone_url=data["clone_url"],
            ssh_url=data["ssh_url"],
            default_branch=data.get("default_branch", "main")
        )
        
        log_success("REPO-CREATE", f"Repository created: {repo.html_url}")
        return repo
    
    def set_topics(self, repo_name: str, topics: List[str]) -> None:
        """Set repository topics"""
        if not topics:
            return
        
        log_info("TOPICS", f"Setting {len(topics)} topics...")
        self._request(
            "PUT",
            f"/repos/{self.user}/{repo_name}/topics",
            json={"names": topics}
        )
        log_success("TOPICS", "Topics configured")
    
    def create_blob(self, repo_name: str, content: bytes) -> BlobResponse:
        """Create blob from file content"""
        # Check file size
        size_mb = len(content) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise GitHubAPIError(f"File too large: {format_size(len(content))}")
        
        # Encode content as base64
        encoded = base64.b64encode(content).decode("utf-8")
        
        try:
            data = self._request(
                "POST",
                f"/repos/{self.user}/{repo_name}/git/blobs",
                json={"content": encoded, "encoding": "base64"}
            )
            return BlobResponse(sha=data["sha"], url=data["url"])
        except GitHubAPIError as e:
            raise GitHubAPIError(f"Blob create failed: {e.message}", e.status_code)
    
    def create_tree(
        self, 
        repo_name: str, 
        entries: List[TreeEntry],
        base_tree: Optional[str] = None
    ) -> TreeResponse:
        """Create git tree from entries"""
        log_info("TREE", f"Creating tree with {len(entries)} entries...")
        
        tree_data = [
            {
                "path": e.path,
                "mode": e.mode,
                "type": e.type,
                "sha": e.sha
            }
            for e in entries
        ]
        
        payload = {"tree": tree_data}
        if base_tree:
            payload["base_tree"] = base_tree
        
        data = self._request(
            "POST",
            f"/repos/{self.user}/{repo_name}/git/trees",
            json=payload
        )
        
        return TreeResponse(sha=data["sha"], url=data["url"])
    
    def create_commit(
        self,
        repo_name: str,
        message: str,
        tree_sha: str,
        parent_sha: Optional[str] = None
    ) -> CommitResponse:
        """Create git commit"""
        log_info("COMMIT", "Creating commit...")
        
        payload = {
            "message": message,
            "tree": tree_sha
        }
        
        if parent_sha:
            payload["parents"] = [parent_sha]
        
        data = self._request(
            "POST",
            f"/repos/{self.user}/{repo_name}/git/commits",
            json=payload
        )
        
        return CommitResponse(
            sha=data["sha"],
            url=data["url"],
            html_url=data["html_url"]
        )
    
    def update_ref(
        self,
        repo_name: str,
        ref: str,
        sha: str,
        force: bool = False
    ) -> None:
        """Update git reference"""
        self._request(
            "PATCH",
            f"/repos/{self.user}/{repo_name}/git/refs/{ref}",
            json={"sha": sha, "force": force}
        )
    
    def create_ref(self, repo_name: str, ref: str, sha: str) -> None:
        """Create git reference"""
        self._request(
            "POST",
            f"/repos/{self.user}/{repo_name}/git/refs",
            json={"ref": f"refs/{ref}", "sha": sha}
        )
    
    def get_default_branch_sha(self, repo_name: str) -> Optional[str]:
        """Get SHA of default branch HEAD"""
        try:
            data = self._request(
                "GET",
                f"/repos/{self.user}/{repo_name}/git/refs/heads/main"
            )
            return data["object"]["sha"]
        except GitHubAPIError:
            return None

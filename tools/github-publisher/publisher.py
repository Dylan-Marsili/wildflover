"""
File: publisher.py
Author: Wildflover
Description: Main publishing logic for GitHub repository
Language: Python 3.10+
"""

from pathlib import Path
from typing import List, Optional

from config import SKIP_PATTERNS, DEFAULT_TOPICS, MAX_FILES_PER_COMMIT
from models import (
    RepoConfig, RepoVisibility, FileEntry, FileStatus,
    TreeEntry, PublishResult
)
from api import GitHubAPI, GitHubAPIError
from utils import (
    log_info, log_error, log_success, log_warning,
    collect_files, format_size, print_summary, Colors
)


class GitHubPublisher:
    """Handles repository publishing workflow"""
    
    def __init__(self, token: str, source_path: str):
        """Initialize publisher with token and source directory"""
        self.api = GitHubAPI(token)
        self.source_path = Path(source_path).resolve()
        self.files: List[FileEntry] = []
        self.tree_entries: List[TreeEntry] = []
    
    def validate_source(self) -> bool:
        """Validate source directory exists"""
        if not self.source_path.exists():
            log_error("VALIDATE", f"Source path not found: {self.source_path}")
            return False
        
        if not self.source_path.is_dir():
            log_error("VALIDATE", "Source path must be a directory")
            return False
        
        log_success("VALIDATE", f"Source: {self.source_path}")
        return True
    
    def collect_files(self) -> int:
        """Collect files from source directory"""
        log_info("COLLECT", "Scanning files...")
        
        file_paths = collect_files(self.source_path, SKIP_PATTERNS)
        total_size = 0
        
        for file_path in file_paths:
            try:
                content = file_path.read_bytes()
                rel_path = str(file_path.relative_to(self.source_path))
                
                # Use forward slashes for git paths
                rel_path = rel_path.replace("\\", "/")
                
                self.files.append(FileEntry(
                    path=rel_path,
                    content=content,
                    status=FileStatus.PENDING
                ))
                total_size += len(content)
                
            except Exception as e:
                log_warning("COLLECT", f"Cannot read: {file_path.name} - {e}")
        
        log_success("COLLECT", f"Found {len(self.files)} files ({format_size(total_size)})")
        return len(self.files)
    
    def upload_blobs(self, repo_name: str, max_workers: int = 1) -> int:
        """Upload file blobs to repository - Sequential to avoid rate limits"""
        log_info("UPLOAD", f"Uploading {len(self.files)} files...")
        
        uploaded = 0
        failed = 0
        
        import time
        
        for i, entry in enumerate(self.files, 1):
            try:
                blob = self.api.create_blob(repo_name, entry.content)
                entry.sha = blob.sha
                entry.status = FileStatus.SUCCESS
                uploaded += 1
                self.tree_entries.append(TreeEntry(
                    path=entry.path,
                    sha=entry.sha
                ))
            except Exception as e:
                entry.status = FileStatus.FAILED
                entry.error = str(e)
                failed += 1
                log_warning("UPLOAD", f"Failed: {entry.path} - {str(e)[:50]}")
            
            # Progress indicator
            if i % 20 == 0 or i == len(self.files):
                pct = (i / len(self.files)) * 100
                print(f"\r{Colors.INFO}[PROGRESS]{Colors.RESET} "
                      f"{i}/{len(self.files)} ({pct:.0f}%) - OK: {uploaded}, FAIL: {failed}", end="")
            
            # Small delay to avoid rate limiting
            time.sleep(0.05)
        
        print()  # New line after progress
        log_success("UPLOAD", f"Uploaded {uploaded} files")
        
        if failed > 0:
            log_warning("UPLOAD", f"Failed: {failed} files")
        
        return uploaded
    
    def create_commit(
        self, 
        repo_name: str, 
        message: str
    ) -> Optional[str]:
        """Create tree and commit"""
        if not self.tree_entries:
            log_error("COMMIT", "No files to commit")
            return None
        
        # Get current HEAD SHA (from auto_init README)
        parent_sha = self.api.get_default_branch_sha(repo_name)
        
        # Create tree with base_tree if exists
        tree = self.api.create_tree(repo_name, self.tree_entries, parent_sha)
        log_success("TREE", f"Tree created: {tree.sha[:8]}")
        
        # Create commit with parent
        commit = self.api.create_commit(repo_name, message, tree.sha, parent_sha)
        log_success("COMMIT", f"Commit created: {commit.sha[:8]}")
        
        # Update main branch reference
        self.api.update_ref(repo_name, "heads/main", commit.sha, force=True)
        
        log_success("REF", "Branch 'main' updated")
        return commit.sha
    
    def publish(
        self,
        repo_name: str,
        description: str = "",
        visibility: str = "public",
        topics: Optional[List[str]] = None,
        commit_message: str = "Initial commit"
    ) -> PublishResult:
        """Execute full publish workflow"""
        
        result = PublishResult(success=False)
        
        try:
            # Step 1: Validate source
            if not self.validate_source():
                result.error = "Invalid source path"
                return result
            
            # Step 2: Check if repo exists
            if self.api.check_repo_exists(repo_name):
                log_error("REPO", f"Repository '{repo_name}' already exists")
                result.error = "Repository already exists"
                return result
            
            # Step 3: Collect files
            file_count = self.collect_files()
            if file_count == 0:
                result.error = "No files to upload"
                return result
            
            # Step 4: Create repository
            vis = RepoVisibility.PRIVATE if visibility == "private" else RepoVisibility.PUBLIC
            config = RepoConfig(
                name=repo_name,
                description=description,
                visibility=vis,
                topics=topics or DEFAULT_TOPICS
            )
            
            repo = self.api.create_repository(config)
            result.repo_url = repo.html_url
            
            # Wait for repo initialization
            import time
            log_info("INIT", "Waiting for repository initialization...")
            time.sleep(3)
            
            # Step 5: Set topics
            self.api.set_topics(repo_name, config.topics)
            
            # Step 6: Upload blobs
            uploaded = self.upload_blobs(repo_name)
            result.files_uploaded = uploaded
            result.files_skipped = len(self.files) - uploaded
            
            # Step 7: Create commit
            commit_sha = self.create_commit(repo_name, commit_message)
            if commit_sha:
                result.commit_sha = commit_sha
                result.success = True
            
            # Print summary
            print_summary(
                total=len(self.files),
                uploaded=result.files_uploaded,
                skipped=result.files_skipped,
                failed=result.files_failed
            )
            
            return result
            
        except GitHubAPIError as e:
            log_error("PUBLISH", f"API Error: {e.message}")
            result.error = e.message
            return result
        except Exception as e:
            log_error("PUBLISH", f"Unexpected error: {str(e)}")
            result.error = str(e)
            return result

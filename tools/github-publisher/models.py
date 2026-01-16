"""
File: models.py
Author: Wildflover
Description: Data models for GitHub Publisher API responses
Language: Python 3.10+
"""

from dataclasses import dataclass, field
from typing import Optional, List
from enum import Enum


class RepoVisibility(Enum):
    """Repository visibility options"""
    PUBLIC = "public"
    PRIVATE = "private"


class FileStatus(Enum):
    """File upload status"""
    PENDING = "pending"
    UPLOADING = "uploading"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class RepoConfig:
    """Repository configuration for creation"""
    name: str
    description: str = ""
    visibility: RepoVisibility = RepoVisibility.PUBLIC
    homepage: str = ""
    topics: List[str] = field(default_factory=list)
    has_issues: bool = True
    has_wiki: bool = False
    has_projects: bool = False
    auto_init: bool = False


@dataclass
class FileEntry:
    """File entry for upload"""
    path: str
    content: bytes
    sha: Optional[str] = None
    status: FileStatus = FileStatus.PENDING
    error: Optional[str] = None


@dataclass
class BlobResponse:
    """GitHub Blob API response"""
    sha: str
    url: str


@dataclass
class TreeEntry:
    """Git tree entry"""
    path: str
    mode: str = "100644"  # Regular file
    type: str = "blob"
    sha: str = ""


@dataclass
class TreeResponse:
    """GitHub Tree API response"""
    sha: str
    url: str
    tree: List[dict] = field(default_factory=list)


@dataclass
class CommitResponse:
    """GitHub Commit API response"""
    sha: str
    url: str
    html_url: str


@dataclass
class RepoResponse:
    """GitHub Repository API response"""
    id: int
    name: str
    full_name: str
    html_url: str
    clone_url: str
    ssh_url: str
    default_branch: str


@dataclass
class PublishResult:
    """Final publish result"""
    success: bool
    repo_url: str = ""
    commit_sha: str = ""
    files_uploaded: int = 0
    files_skipped: int = 0
    files_failed: int = 0
    error: Optional[str] = None

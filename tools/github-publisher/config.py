"""
File: config.py
Author: Wildflover
Description: Configuration for GitHub Publisher tool - Wildflover Edition
Language: Python 3.10+
"""

# [META] Tool metadata
VERSION = "1.0.0"
AUTHOR = "Wildflover"
TOOL_NAME = "GitHub Publisher"

# [PROJECT] Wildflover project defaults
PROJECT_NAME = "wildflover"
PROJECT_DESCRIPTION = "Modern League of Legends Skin Manager - Built with Tauri, React & Rust"
PROJECT_HOMEPAGE = "https://github.com/wildflover/wildflover"

# [API] GitHub API configuration
GITHUB_API_BASE = "https://api.github.com"
GITHUB_API_VERSION = "2022-11-28"

# [LIMITS] Rate limiting
MAX_FILE_SIZE_MB = 50
MAX_FILES_PER_COMMIT = 100
CHUNK_SIZE = 1024 * 1024  # 1MB chunks

# [SKIP] Files to exclude from upload
SKIP_PATTERNS = {
    # Directories
    "node_modules", ".git", "target", "dist", "build",
    "__pycache__", ".venv", "venv", ".idea", ".vscode",
    ".kiro", "coverage", ".next", ".nuxt",
    # Files
    ".env", ".env.local", "*.log", "*.tmp",
    "package-lock.json", "Cargo.lock",
    # Wildflover specific
    "*.exe", "*.dll", "security_report*.json",
    # Large files (GitHub 100MB limit)
    "hashes.game.txt", "*.wad", "*.client"
}

# [INCLUDE] Always include these files
ALWAYS_INCLUDE = {
    "README.md", "LICENSE", ".gitignore", 
    "CONTRIBUTING.md", "SECURITY.md", ".env.example"
}

# [TOPICS] Wildflover repository topics
DEFAULT_TOPICS = [
    "tauri",
    "react", 
    "typescript",
    "rust",
    "league-of-legends",
    "skin-manager",
    "desktop-app",
    "discord-oauth",
    "mod-manager",
    "vite"
]

# [COMMIT] Default commit message
DEFAULT_COMMIT_MESSAGE = "Initial release - Wildflover v1.0.0"

# [LABELS] Repository labels to create
REPO_LABELS = [
    {"name": "bug", "color": "d73a4a", "description": "Something isn't working"},
    {"name": "enhancement", "color": "a2eeef", "description": "New feature or request"},
    {"name": "documentation", "color": "0075ca", "description": "Improvements or additions to documentation"},
    {"name": "help wanted", "color": "008672", "description": "Extra attention is needed"},
    {"name": "good first issue", "color": "7057ff", "description": "Good for newcomers"},
]

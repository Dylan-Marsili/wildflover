"""
File: config.py
Author: Wildflover
Description: Configuration constants for GitHub Prepare tool
Language: Python 3.10+
"""

from enum import Enum

# [META] Tool metadata
VERSION = "1.0.0"
AUTHOR = "Wildflover"
TOOL_NAME = "GitHub Prepare"


class Severity(Enum):
    """Security issue severity levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


# [PATTERNS] Sensitive data detection patterns
SENSITIVE_PATTERNS = {
    "discord_token": {
        "pattern": r"[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,}",
        "severity": Severity.CRITICAL,
        "description": "Discord Bot Token detected",
        "suggestion": "Move to environment variable DISCORD_TOKEN"
    },
    "discord_webhook": {
        "pattern": r"https://discord\.com/api/webhooks/\d+/[\w-]+",
        "severity": Severity.HIGH,
        "description": "Discord Webhook URL detected",
        "suggestion": "Move to environment variable or config file"
    },
    "github_pat": {
        "pattern": r"ghp_[a-zA-Z0-9]{36}",
        "severity": Severity.CRITICAL,
        "description": "GitHub Personal Access Token detected",
        "suggestion": "Use GitHub Secrets or environment variables"
    },
    "github_oauth": {
        "pattern": r"gho_[a-zA-Z0-9]{36}",
        "severity": Severity.CRITICAL,
        "description": "GitHub OAuth Token detected",
        "suggestion": "Never commit OAuth tokens"
    },
    "aws_access_key": {
        "pattern": r"AKIA[0-9A-Z]{16}",
        "severity": Severity.CRITICAL,
        "description": "AWS Access Key ID detected",
        "suggestion": "Use AWS Secrets Manager"
    },
    "private_key": {
        "pattern": r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
        "severity": Severity.CRITICAL,
        "description": "Private Key detected",
        "suggestion": "Never commit private keys"
    },
    "api_key_generic": {
        "pattern": r"['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,}['\"]",
        "severity": Severity.HIGH,
        "description": "Generic API Key detected",
        "suggestion": "Move to environment variable"
    },
    "jwt_token": {
        "pattern": r"eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*",
        "severity": Severity.HIGH,
        "description": "JWT Token detected",
        "suggestion": "Tokens should not be committed"
    },
    "encrypted_hex": {
        "pattern": r"0x[0-9a-fA-F]{2},\s*0x[0-9a-fA-F]{2},\s*0x[0-9a-fA-F]{2}",
        "severity": Severity.MEDIUM,
        "description": "Encrypted/Obfuscated data detected",
        "suggestion": "Review if this contains sensitive data"
    },
    "connection_string": {
        "pattern": r"(mongodb|mysql|postgres|redis)://[^\s'\"]+",
        "severity": Severity.HIGH,
        "description": "Database connection string detected",
        "suggestion": "Use environment variables"
    },
}

# [SKIP] Files and directories to skip during scan
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pdf", ".doc", ".docx", ".lock", ".sum"
}

SKIP_DIRECTORIES = {
    "node_modules", ".git", "target", "dist", "build",
    "__pycache__", ".venv", "venv", ".idea", ".vscode",
    "coverage", ".next", ".nuxt"
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "Cargo.lock",
    "pnpm-lock.yaml", "composer.lock"
}

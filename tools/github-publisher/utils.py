"""
File: utils.py
Author: Wildflover
Description: Utility functions for GitHub Publisher
Language: Python 3.10+
"""

import os
import sys
import fnmatch
from pathlib import Path
from typing import List, Set

from config import VERSION, TOOL_NAME, AUTHOR, SKIP_PATTERNS, ALWAYS_INCLUDE


# [COLORS] Terminal color codes
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    
    # Status colors
    SUCCESS = "\033[92m"
    ERROR = "\033[91m"
    WARNING = "\033[93m"
    INFO = "\033[94m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    
    # Title colors
    TITLE = "\033[38;5;39m"
    SUBTITLE = "\033[38;5;245m"


def enable_windows_colors():
    """Enable ANSI colors on Windows terminal"""
    if sys.platform == "win32":
        os.system("")
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass


def print_banner():
    """Display tool banner"""
    enable_windows_colors()
    
    banner = f"""
{Colors.MAGENTA}{Colors.BOLD}
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   ██╗    ██╗██╗██╗     ██████╗ ███████╗██╗      ██████╗ ██╗   ██╗ ║
    ║   ██║    ██║██║██║     ██╔══██╗██╔════╝██║     ██╔═══██╗██║   ██║ ║
    ║   ██║ █╗ ██║██║██║     ██║  ██║█████╗  ██║     ██║   ██║██║   ██║ ║
    ║   ██║███╗██║██║██║     ██║  ██║██╔══╝  ██║     ██║   ██║╚██╗ ██╔╝ ║
    ║   ╚███╔███╔╝██║███████╗██████╔╝██║     ███████╗╚██████╔╝ ╚████╔╝  ║
    ║    ╚══╝╚══╝ ╚═╝╚══════╝╚═════╝ ╚═╝     ╚══════╝ ╚═════╝   ╚═══╝   ║
    ║                                                                   ║
    ║                    GitHub Publisher v{VERSION}                       ║
    ╚═══════════════════════════════════════════════════════════════════╝
{Colors.RESET}
{Colors.SUBTITLE}    {TOOL_NAME} | Author: {AUTHOR}{Colors.RESET}
{Colors.DIM}    Automated GitHub Repository Publisher for Wildflover Project{Colors.RESET}
"""
    print(banner)


def log(tag: str, message: str, color: str = Colors.INFO):
    """Print formatted log message"""
    print(f"{color}[{tag}]{Colors.RESET} {message}")


def log_success(tag: str, message: str):
    """Print success message"""
    log(tag, message, Colors.SUCCESS)


def log_error(tag: str, message: str):
    """Print error message"""
    log(tag, message, Colors.ERROR)


def log_warning(tag: str, message: str):
    """Print warning message"""
    log(tag, message, Colors.WARNING)


def log_info(tag: str, message: str):
    """Print info message"""
    log(tag, message, Colors.INFO)


def should_skip_path(path: str, skip_patterns: Set[str]) -> bool:
    """Check if path should be skipped"""
    path_parts = Path(path).parts
    
    for pattern in skip_patterns:
        # Check directory names
        if pattern in path_parts:
            return True
        # Check file patterns
        if fnmatch.fnmatch(Path(path).name, pattern):
            return True
    
    return False


def should_include_file(path: str) -> bool:
    """Check if file should always be included"""
    filename = Path(path).name
    return filename in ALWAYS_INCLUDE


def collect_files(root_path: Path, skip_patterns: Set[str]) -> List[Path]:
    """Collect all files to upload"""
    files = []
    
    for item in root_path.rglob("*"):
        if item.is_file():
            rel_path = str(item.relative_to(root_path))
            
            # Always include important files
            if should_include_file(rel_path):
                files.append(item)
                continue
            
            # Skip unwanted files
            if should_skip_path(rel_path, skip_patterns):
                continue
            
            files.append(item)
    
    return sorted(files, key=lambda x: str(x))


def format_size(size_bytes: int) -> str:
    """Format byte size to human readable"""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def print_summary(total: int, uploaded: int, skipped: int, failed: int):
    """Print upload summary"""
    print(f"\n{Colors.BOLD}{'─' * 50}{Colors.RESET}")
    print(f"{Colors.CYAN}[SUMMARY]{Colors.RESET} Upload Statistics")
    print(f"  Total files:    {total}")
    print(f"  {Colors.SUCCESS}Uploaded:{Colors.RESET}       {uploaded}")
    print(f"  {Colors.WARNING}Skipped:{Colors.RESET}        {skipped}")
    print(f"  {Colors.ERROR}Failed:{Colors.RESET}         {failed}")
    print(f"{Colors.BOLD}{'─' * 50}{Colors.RESET}\n")

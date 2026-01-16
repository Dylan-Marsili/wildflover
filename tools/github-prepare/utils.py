"""
File: utils.py
Author: Wildflover
Description: Utility functions and terminal output helpers
Language: Python 3.10+
"""

from datetime import datetime
from config import VERSION, AUTHOR, TOOL_NAME, Severity


class Colors:
    """ANSI color codes for terminal output"""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"


def get_severity_color(severity: Severity) -> str:
    """Get color code for severity level"""
    return {
        Severity.CRITICAL: Colors.RED,
        Severity.HIGH: Colors.YELLOW,
        Severity.MEDIUM: Colors.BLUE,
        Severity.LOW: Colors.GRAY,
        Severity.INFO: Colors.WHITE
    }.get(severity, Colors.WHITE)


def print_banner():
    """Display tool banner"""
    print(f"""
{Colors.CYAN}{Colors.BOLD}
    +-----------------------------------------------------------+
    |                                                           |
    |   {Colors.WHITE}GitHub Prepare Tool{Colors.CYAN}                                   |
    |   {Colors.GRAY}Professional Repository Security Scanner{Colors.CYAN}              |
    |                                                           |
    |   {Colors.YELLOW}Version: {VERSION}{Colors.CYAN}                                        |
    |   {Colors.YELLOW}Author:  {AUTHOR}{Colors.CYAN}                                      |
    |                                                           |
    +-----------------------------------------------------------+
{Colors.RESET}""")


def log(level: str, message: str):
    """Formatted logging output"""
    colors = {
        "INFO": Colors.BLUE,
        "WARN": Colors.YELLOW,
        "ERROR": Colors.RED,
        "SUCCESS": Colors.GREEN,
        "DEBUG": Colors.GRAY
    }
    color = colors.get(level, Colors.WHITE)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{Colors.GRAY}[{timestamp}]{Colors.RESET} {color}[{level}]{Colors.RESET} {message}")


def mask_sensitive(content: str, visible_chars: int = 4) -> str:
    """Mask sensitive content for display"""
    if len(content) <= visible_chars * 2:
        return "*" * len(content)
    return content[:visible_chars] + "*" * (len(content) - visible_chars * 2) + content[-visible_chars:]

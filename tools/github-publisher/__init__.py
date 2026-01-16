"""
File: __init__.py
Author: Wildflover
Description: GitHub Publisher package initialization
Language: Python 3.10+
"""

from .config import VERSION, TOOL_NAME, AUTHOR
from .publisher import GitHubPublisher
from .api import GitHubAPI, GitHubAPIError

__all__ = [
    "VERSION",
    "TOOL_NAME", 
    "AUTHOR",
    "GitHubPublisher",
    "GitHubAPI",
    "GitHubAPIError"
]

"""
File: models.py
Author: Wildflover
Description: Data models for GitHub Prepare tool
Language: Python 3.10+
"""

from dataclasses import dataclass, field
from typing import List
from config import Severity


@dataclass
class SecurityIssue:
    """Represents a detected security issue"""
    file_path: str
    line_number: int
    severity: Severity
    issue_type: str
    description: str
    matched_content: str = ""
    suggestion: str = ""


@dataclass
class ScanResult:
    """Complete scan result container"""
    total_files: int = 0
    scanned_files: int = 0
    skipped_files: int = 0
    issues: List[SecurityIssue] = field(default_factory=list)
    scan_time: float = 0.0
    
    @property
    def has_critical(self) -> bool:
        """Check if any critical issues exist"""
        return any(i.severity == Severity.CRITICAL for i in self.issues)
    
    @property
    def issue_count_by_severity(self) -> dict:
        """Get issue counts grouped by severity"""
        counts = {}
        for issue in self.issues:
            counts[issue.severity] = counts.get(issue.severity, 0) + 1
        return counts

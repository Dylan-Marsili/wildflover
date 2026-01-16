"""
File: scanner.py
Author: Wildflover
Description: Core scanning engine for sensitive data detection
Language: Python 3.10+
"""

import re
import time
from pathlib import Path
from typing import List

from config import (
    SENSITIVE_PATTERNS, SKIP_EXTENSIONS, 
    SKIP_DIRECTORIES, SKIP_FILES
)
from models import SecurityIssue, ScanResult
from utils import log, mask_sensitive


class SecurityScanner:
    """Core scanner for detecting sensitive data in repositories"""
    
    def __init__(self, root_path: str, verbose: bool = False):
        self.root_path = Path(root_path).resolve()
        self.verbose = verbose
        self.result = ScanResult()
        
    def should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped"""
        if file_path.suffix.lower() in SKIP_EXTENSIONS:
            return True
        if file_path.name in SKIP_FILES:
            return True
        for part in file_path.parts:
            if part in SKIP_DIRECTORIES:
                return True
        return False
        
    def scan_file(self, file_path: Path) -> List[SecurityIssue]:
        """Scan a single file for sensitive data"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.read().split('\n')
                
            for pattern_name, config in SENSITIVE_PATTERNS.items():
                regex = re.compile(config["pattern"], re.IGNORECASE)
                
                for line_num, line in enumerate(lines, 1):
                    for match in regex.findall(line):
                        # Skip placeholder values
                        if any(skip in str(match).upper() for skip in 
                               ["YOUR_", "PLACEHOLDER", "EXAMPLE", "XXX"]):
                            continue
                            
                        issues.append(SecurityIssue(
                            file_path=str(file_path.relative_to(self.root_path)),
                            line_number=line_num,
                            severity=config["severity"],
                            issue_type=pattern_name,
                            description=config["description"],
                            matched_content=mask_sensitive(str(match)),
                            suggestion=config["suggestion"]
                        ))
                        
        except Exception as e:
            if self.verbose:
                log("DEBUG", f"Could not scan {file_path}: {e}")
                
        return issues
        
    def scan(self) -> ScanResult:
        """Scan entire repository"""
        start_time = time.time()
        log("INFO", f"Scanning: {self.root_path}")
        
        all_files = list(self.root_path.rglob("*"))
        self.result.total_files = len([f for f in all_files if f.is_file()])
        
        for file_path in all_files:
            if not file_path.is_file():
                continue
                
            if self.should_skip_file(file_path):
                self.result.skipped_files += 1
                continue
                
            self.result.scanned_files += 1
            issues = self.scan_file(file_path)
            self.result.issues.extend(issues)
            
            if self.verbose and issues:
                log("WARN", f"Found {len(issues)} issue(s) in {file_path.name}")
                
        self.result.scan_time = time.time() - start_time
        return self.result

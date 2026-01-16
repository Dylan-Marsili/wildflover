"""
File: reporter.py
Author: Wildflover
Description: Report generation and output formatting
Language: Python 3.10+
"""

import json
from datetime import datetime
from typing import Optional

from config import VERSION, TOOL_NAME, Severity
from models import ScanResult
from utils import Colors, get_severity_color, log


class ReportGenerator:
    """Generates scan reports in various formats"""
    
    def __init__(self, result: ScanResult, root_path: str):
        self.result = result
        self.root_path = root_path
        
    def print_results(self):
        """Display scan results to terminal"""
        print(f"\n{Colors.CYAN}{'=' * 60}{Colors.RESET}")
        print(f"{Colors.BOLD}SCAN RESULTS{Colors.RESET}")
        print(f"{Colors.CYAN}{'=' * 60}{Colors.RESET}\n")
        
        # Statistics
        print(f"{Colors.WHITE}Statistics:{Colors.RESET}")
        print(f"  Total files:   {self.result.total_files}")
        print(f"  Scanned:       {self.result.scanned_files}")
        print(f"  Skipped:       {self.result.skipped_files}")
        print(f"  Scan time:     {self.result.scan_time:.2f}s")
        print()
        
        if self.result.issues:
            self._print_issues()
        else:
            print(f"{Colors.GREEN}{Colors.BOLD}No security issues found!{Colors.RESET}")
            print(f"{Colors.GREEN}Repository is ready for GitHub.{Colors.RESET}\n")
            
    def _print_issues(self):
        """Print detailed issue list"""
        counts = self.result.issue_count_by_severity
        
        print(f"{Colors.RED}{Colors.BOLD}Security Issues: {len(self.result.issues)}{Colors.RESET}\n")
        
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            count = counts.get(severity, 0)
            if count > 0:
                color = get_severity_color(severity)
                print(f"  {color}[{severity.value}]{Colors.RESET} {count} issue(s)")
                
        print(f"\n{Colors.CYAN}{'-' * 60}{Colors.RESET}\n")
        
        for issue in sorted(self.result.issues, key=lambda x: x.severity.value):
            color = get_severity_color(issue.severity)
            print(f"{color}[{issue.severity.value}]{Colors.RESET} {issue.description}")
            print(f"  {Colors.GRAY}File:{Colors.RESET} {issue.file_path}:{issue.line_number}")
            print(f"  {Colors.GRAY}Match:{Colors.RESET} {issue.matched_content}")
            print(f"  {Colors.GREEN}Fix:{Colors.RESET} {issue.suggestion}")
            print()
            
    def generate_json(self, output_path: Optional[str] = None) -> str:
        """Generate JSON report"""
        report = {
            "tool": TOOL_NAME,
            "version": VERSION,
            "scan_date": datetime.now().isoformat(),
            "repository": self.root_path,
            "statistics": {
                "total_files": self.result.total_files,
                "scanned_files": self.result.scanned_files,
                "skipped_files": self.result.skipped_files,
                "scan_time_seconds": round(self.result.scan_time, 2),
                "issues_found": len(self.result.issues)
            },
            "issues": [
                {
                    "file": i.file_path,
                    "line": i.line_number,
                    "severity": i.severity.value,
                    "type": i.issue_type,
                    "description": i.description,
                    "suggestion": i.suggestion
                }
                for i in self.result.issues
            ]
        }
        
        report_json = json.dumps(report, indent=2)
        
        if output_path:
            with open(output_path, 'w') as f:
                f.write(report_json)
            log("SUCCESS", f"Report saved: {output_path}")
            
        return report_json

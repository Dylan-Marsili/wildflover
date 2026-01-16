#!/usr/bin/env python3
"""
File: main.py
Author: Wildflover
Description: Entry point for GitHub Prepare tool
Language: Python 3.10+
"""

import sys
import argparse

from config import VERSION, TOOL_NAME, AUTHOR, Severity
from scanner import SecurityScanner
from reporter import ReportGenerator
from utils import print_banner


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description=f"{TOOL_NAME} - Repository Security Scanner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  python main.py .                    Scan current directory
  python main.py /path/to/repo -v    Verbose output
  python main.py . -o report.json    Generate JSON report

Author: {AUTHOR} | Version: {VERSION}
        """
    )
    
    parser.add_argument("path", nargs="?", default=".", help="Repository path")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    parser.add_argument("-o", "--output", help="Output JSON report file")
    parser.add_argument("--version", action="version", version=f"{TOOL_NAME} v{VERSION}")
    
    args = parser.parse_args()
    
    # Display banner
    print_banner()
    
    # Run scan
    scanner = SecurityScanner(args.path, verbose=args.verbose)
    result = scanner.scan()
    
    # Generate report
    reporter = ReportGenerator(result, str(scanner.root_path))
    reporter.print_results()
    
    if args.output:
        reporter.generate_json(args.output)
        
    # Exit code
    sys.exit(1 if result.has_critical else 0)


if __name__ == "__main__":
    main()

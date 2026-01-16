#!/usr/bin/env python3
"""
File: main.py
Author: Wildflover
Description: Entry point for GitHub Publisher CLI tool - Wildflover Edition
Language: Python 3.10+
"""

import sys
import os
import argparse
from getpass import getpass

from config import (
    VERSION, TOOL_NAME, AUTHOR, DEFAULT_TOPICS,
    PROJECT_NAME, PROJECT_DESCRIPTION, DEFAULT_COMMIT_MESSAGE
)
from publisher import GitHubPublisher
from utils import print_banner, log_success, log_error, log_info, Colors


def get_token_from_env() -> str:
    """Get GitHub token from environment variable"""
    return os.environ.get("GITHUB_TOKEN", "")


def prompt_for_token() -> str:
    """Prompt user for GitHub token"""
    print(f"\n{Colors.WARNING}[TOKEN]{Colors.RESET} GitHub Personal Access Token required")
    print(f"{Colors.DIM}  Create at: https://github.com/settings/tokens{Colors.RESET}")
    print(f"{Colors.DIM}  Required scopes: repo, write:packages{Colors.RESET}\n")
    
    token = getpass("Enter token: ")
    return token.strip()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description=f"{TOOL_NAME} - Wildflover GitHub Repository Publisher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  python main.py ../                              Publish parent directory as 'wildflover'
  python main.py ../ wildflover-app               Custom repository name
  python main.py ../ -d "My custom description"   Custom description
  python main.py ../ --private                    Private repository

Quick Start (Wildflover):
  python main.py ../

Environment:
  GITHUB_TOKEN    GitHub Personal Access Token (optional)

Author: {AUTHOR} | Version: {VERSION}
        """
    )
    
    # Required arguments
    parser.add_argument(
        "source",
        nargs="?",
        default="../",
        help="Source directory path (default: ../)"
    )
    parser.add_argument(
        "repo_name",
        nargs="?",
        default=PROJECT_NAME,
        help=f"Repository name (default: {PROJECT_NAME})"
    )
    
    # Optional arguments
    parser.add_argument(
        "-d", "--description",
        default=PROJECT_DESCRIPTION,
        help="Repository description"
    )
    parser.add_argument(
        "--private",
        action="store_true",
        help="Create private repository"
    )
    parser.add_argument(
        "--topics",
        help="Comma-separated topics (default: Wildflover topics)"
    )
    parser.add_argument(
        "-m", "--message",
        default=DEFAULT_COMMIT_MESSAGE,
        help="Commit message"
    )
    parser.add_argument(
        "-t", "--token",
        help="GitHub token (or use GITHUB_TOKEN env)"
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"{TOOL_NAME} v{VERSION}"
    )
    
    args = parser.parse_args()
    
    # Display banner
    print_banner()
    
    # Get token
    token = args.token or get_token_from_env()
    if not token:
        token = prompt_for_token()
    
    if not token:
        log_error("TOKEN", "No token provided")
        sys.exit(1)
    
    # Parse topics
    topics = DEFAULT_TOPICS
    if args.topics:
        topics = [t.strip() for t in args.topics.split(",")]
    
    # Create publisher
    publisher = GitHubPublisher(token, args.source)
    
    # Execute publish
    visibility = "private" if args.private else "public"
    
    log_info("START", f"Publishing Wildflover to GitHub...")
    print(f"{Colors.DIM}  Repository: {args.repo_name}{Colors.RESET}")
    print(f"{Colors.DIM}  Visibility: {visibility}{Colors.RESET}")
    print(f"{Colors.DIM}  Topics: {', '.join(topics[:5])}...{Colors.RESET}\n")
    
    result = publisher.publish(
        repo_name=args.repo_name,
        description=args.description,
        visibility=visibility,
        topics=topics,
        commit_message=args.message
    )
    
    # Final output
    if result.success:
        print(f"\n{Colors.SUCCESS}{Colors.BOLD}Wildflover published successfully!{Colors.RESET}")
        print(f"{Colors.CYAN}[URL]{Colors.RESET} {result.repo_url}")
        print(f"{Colors.CYAN}[COMMIT]{Colors.RESET} {result.commit_sha[:8]}")
        print(f"\n{Colors.DIM}Next steps:{Colors.RESET}")
        print(f"{Colors.DIM}  1. Visit {result.repo_url}{Colors.RESET}")
        print(f"{Colors.DIM}  2. Add repository secrets for CI/CD{Colors.RESET}")
        print(f"{Colors.DIM}  3. Enable GitHub Pages if needed{Colors.RESET}")
        sys.exit(0)
    else:
        print(f"\n{Colors.ERROR}{Colors.BOLD}Publication failed!{Colors.RESET}")
        if result.error:
            print(f"{Colors.ERROR}[ERROR]{Colors.RESET} {result.error}")
        sys.exit(1)


if __name__ == "__main__":
    main()

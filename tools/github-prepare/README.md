# GitHub Prepare Tool

Professional repository security scanner for preparing projects for GitHub publication.

## Author
Wildflover

## Version
1.0.0

## Features

| Feature | Description |
|---------|-------------|
| Token Detection | Discord, GitHub, AWS tokens |
| Secret Scanning | API keys, passwords, private keys |
| Pattern Matching | JWT, connection strings, encrypted data |
| JSON Reports | Export findings for CI/CD integration |
| Fast Scanning | Skips binary and lock files |

## Installation

No external dependencies required. Uses Python 3.10+ standard library.

```bash
cd tools/github-prepare
python main.py --help
```

## Usage

### Basic Scan
```bash
python main.py /path/to/repository
```

### Verbose Output
```bash
python main.py . -v
```

### Generate JSON Report
```bash
python main.py . -o security-report.json
```

## Detected Patterns

| Pattern | Severity | Example |
|---------|----------|---------|
| Discord Token | CRITICAL | `MTk...` |
| GitHub PAT | CRITICAL | `ghp_...` |
| AWS Access Key | CRITICAL | `AKIA...` |
| Private Key | CRITICAL | `-----BEGIN...` |
| Discord Webhook | HIGH | `https://discord.com/api/webhooks/...` |
| JWT Token | HIGH | `eyJ...` |
| API Key | HIGH | `api_key = "..."` |
| Connection String | HIGH | `db://user:***@host` |
| Encrypted Hex | MEDIUM | `0x00, 0x01, ...` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No critical issues |
| 1 | Critical issues found |

## Project Structure

```
github-prepare/
├── main.py          # Entry point
├── config.py        # Configuration and patterns
├── models.py        # Data models
├── scanner.py       # Core scanning engine
├── reporter.py      # Report generation
├── utils.py         # Utility functions
└── README.md        # Documentation
```

## Integration

### Pre-commit Hook
```bash
#!/bin/bash
python tools/github-prepare/main.py . --quiet
if [ $? -ne 0 ]; then
    echo "Security issues detected. Commit blocked."
    exit 1
fi
```

### GitHub Actions
```yaml
- name: Security Scan
  run: python tools/github-prepare/main.py . -o report.json
```

## License

MIT License - Wildflover

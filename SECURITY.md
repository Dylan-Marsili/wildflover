# Security Policy

## Author: Wildflover
## Description: Security guidelines and vulnerability reporting

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Measures

### Authentication
- Discord OAuth2 with PKCE flow
- Client secret stored in compiled Rust binary
- Tokens stored locally with secure storage
- Guild verification for access control

### Data Protection
- No sensitive data transmitted to third parties
- Local storage encryption for tokens
- Session-based cache invalidation
- Automatic token refresh mechanism

### Network Security
- HTTPS-only API communications
- Rate limiting protection
- Request timeout configurations
- Retry mechanisms with exponential backoff

## Configuration Security

### Sensitive Files (Never Commit)
- `.env` - Environment variables
- `discord.config.ts` - Discord credentials
- `*.secret` - Secret files
- `*.secrets.json` - Secret JSON files

### Safe to Commit
- `.env.example` - Template without values
- Source code with placeholder values
- Configuration templates

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email: [your-security-email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline
- Initial response: 48 hours
- Status update: 7 days
- Resolution target: 30 days

## Best Practices for Contributors

1. Never commit credentials or secrets
2. Use environment variables for sensitive data
3. Review code for hardcoded values before PR
4. Keep dependencies updated
5. Follow secure coding guidelines

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve Wildflover's security.

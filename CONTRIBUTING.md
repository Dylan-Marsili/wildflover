# Contributing to Wildflover

Thank you for your interest in contributing to Wildflover! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Rust >= 1.70.0
- Git

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/wildflover.git
cd wildflover

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - System information

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Explain the use case
4. Describe the proposed solution

### Pull Requests

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Test thoroughly
5. Commit with clear messages:
   ```bash
   git commit -m "feat: add new feature description"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Open a Pull Request

## Coding Standards

### TypeScript/React

- Use TypeScript strict mode
- Follow React best practices
- Use functional components with hooks
- Add proper type definitions
- Comment complex logic

### Rust

- Follow Rust conventions
- Use proper error handling
- Add documentation comments
- Keep functions focused and small

### CSS

- Use CSS variables for theming
- Follow BEM naming convention
- Keep styles modular
- Support dark theme

### Commit Messages

Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

## Project Structure

```
src/                 # React frontend
src-tauri/           # Rust backend
public/              # Static assets
tools/               # Development utilities
```

## Testing

```bash
# Run frontend tests
npm run test

# Build and test
npm run tauri build
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for functions
- Update type definitions
- Include examples where helpful

## Questions?

Feel free to open an issue for questions or join our Discord community.

---

Thank you for contributing to Wildflover!

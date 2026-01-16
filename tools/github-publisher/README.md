# GitHub Publisher

Wildflover projesini GitHub'a otomatik olarak yayınlayan CLI aracı.

## Features

- GitHub API ile otomatik repository oluşturma
- Tüm proje dosyalarını blob olarak yükleme
- Git tree ve commit oluşturma
- Repository topics otomatik ayarlama
- Public/Private visibility desteği
- Paralel dosya yükleme (performans optimizasyonu)
- Profesyonel terminal çıktısı (renkli loglar)
- Wildflover'a özel default ayarlar

## Requirements

- Python 3.10+
- `requests` library

## Installation

```bash
pip install requests
```

## Quick Start (Wildflover)

```bash
# En basit kullanım - parent klasörü 'wildflover' olarak yayınlar
python main.py

# Veya açıkça belirt
python main.py ../ wildflover
```

## Usage

### Basic Usage

```bash
python main.py ../                    # Parent directory as 'wildflover'
python main.py ../ my-repo-name       # Custom repository name
```

### With Options

```bash
# Custom description
python main.py ../ wildflover -d "League of Legends Skin Manager"

# Private repository
python main.py ../ wildflover --private

# Custom topics
python main.py ../ wildflover --topics tauri,react,rust,lol

# Custom commit message
python main.py ../ wildflover -m "Release v1.0.0"
```

### Environment Variable

```bash
# Windows CMD
set GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Windows PowerShell
$env:GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Linux/Mac
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

## Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `source` | `../` | Source directory path |
| `repo_name` | `wildflover` | Repository name |
| `-d, --description` | Wildflover desc | Repository description |
| `--private` | false | Create private repository |
| `--topics` | Wildflover topics | Comma-separated topics |
| `-m, --message` | Initial release | Commit message |
| `-t, --token` | env | GitHub token |

## Default Topics (Wildflover)

- tauri
- react
- typescript
- rust
- league-of-legends
- skin-manager
- desktop-app
- discord-oauth
- mod-manager
- vite

## Skip Patterns

Otomatik olarak atlanan dosya/klasörler:

**Directories:**
- `node_modules`, `.git`, `target`, `dist`, `build`
- `__pycache__`, `.venv`, `.idea`, `.vscode`, `.kiro`

**Files:**
- `.env`, `.env.local`, `*.log`, `*.tmp`
- `package-lock.json`, `Cargo.lock`
- `*.exe`, `*.dll` (binary files)

## Token Permissions

GitHub Personal Access Token oluştur: https://github.com/settings/tokens

Gerekli izinler:
- `repo` - Full control of private repositories
- `write:packages` - Upload packages (optional)

## Example Output

```
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   ██╗    ██╗██╗██╗     ██████╗ ███████╗██╗      ██████╗ ██╗   ██╗ ║
    ║   ...                                                             ║
    ╚═══════════════════════════════════════════════════════════════════╝

[AUTH] Verifying authentication...
[AUTH] Authenticated as: wildflover
[VALIDATE] Source: C:\Projects\github-wildflover
[COLLECT] Found 127 files (4.2 MB)
[REPO-CREATE] Creating repository: wildflover
[REPO-CREATE] Repository created: https://github.com/wildflover/wildflover
[TOPICS] Setting 10 topics...
[UPLOAD] Uploading 127 files...
[PROGRESS] 127/127 (100%)
[TREE] Tree created: a1b2c3d4
[COMMIT] Commit created: e5f6g7h8

Wildflover published successfully!
[URL] https://github.com/wildflover/wildflover
[COMMIT] e5f6g7h8

Next steps:
  1. Visit https://github.com/wildflover/wildflover
  2. Add repository secrets for CI/CD
  3. Enable GitHub Pages if needed
```

## Author

Wildflover

## License

MIT License

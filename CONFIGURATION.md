# Configuration Guide

## Overview

CC-MD-Search-CLI supports project-specific configuration through `.ccmdsrc` files. This allows you to set default directories, exclude patterns, and customize search behavior per project.

## Quick Start

```bash
# Create a config file in your project
ccmds init

# View current configuration
ccmds config

# Search using config defaults
ccmds find "authentication"
```

---

## Configuration File (`.ccmdsrc`)

### Creating a Config File

```bash
# Create with default settings
ccmds init

# Create with custom directories
ccmds init -d ./docs ./wiki

# Overwrite existing config
ccmds init --force
```

### File Locations

The CLI looks for config files in this order:

1. **Current directory** (project-specific)
   - `.ccmdsrc`
   - `.ccmdsrc.json`
   - `ccmds.config.json`

2. **Parent directories** (monorepo support)
   - Walks up to root looking for config files

3. **Home directory** (user defaults)
   - `~/.ccmdsrc`

4. **Built-in defaults**
   - Used when no config file is found

### Full Configuration Schema

```json
{
  "documentDirectories": ["./docs"],
  "exclude": [
    "**/node_modules/**",
    "**/.*/**"
  ],
  "outputMode": "json",
  "limit": 10,
  "fuzzy": {
    "threshold": 0.4,
    "weights": {
      "title": 2,
      "description": 1.5,
      "tags": 1.5,
      "body": 1
    }
  },
  "preview": {
    "topResults": 600,
    "midResults": 300,
    "otherResults": 150
  },
  "frontmatterFields": ["title", "description", "tags", "category", "summary", "keywords"],
  "extensions": [".md", ".markdown"],
  "aliases": {}
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `documentDirectories` | `string[]` | `["."]` | Directories to search when none specified |
| `exclude` | `string[]` | `[]` | Glob patterns to always exclude |
| `outputMode` | `string` | `"json"` | Default output mode |
| `limit` | `number` | `10` | Default result limit for find |
| `fuzzy.threshold` | `number` | `0.4` | Fuzzy match threshold (0=exact, 1=loose) |
| `fuzzy.weights` | `object` | See above | Field weights for search scoring |
| `preview.topResults` | `number` | `600` | Preview chars for results 1-3 |
| `preview.midResults` | `number` | `300` | Preview chars for results 4-7 |
| `preview.otherResults` | `number` | `150` | Preview chars for remaining results |
| `frontmatterFields` | `string[]` | See above | Frontmatter fields to include |
| `extensions` | `string[]` | `[".md", ".markdown"]` | File extensions to search |
| `aliases` | `object` | `{}` | Command shortcuts (planned) |
| `cache.enabled` | `boolean` | `false` | Enable result caching |
| `cache.ttl` | `number` | `300` | Cache expiration in seconds |
| `cache.maxEntries` | `number` | `50` | Maximum cached queries |

---

## Configuration Examples

### Simple Project

```json
{
  "documentDirectories": ["./docs"],
  "exclude": ["**/node_modules/**"]
}
```

### Documentation-Heavy Project

```json
{
  "documentDirectories": [
    "./docs/user-guide",
    "./docs/api-reference",
    "./docs/tutorials"
  ],
  "exclude": [
    "**/drafts/**",
    "**/archive/**",
    "**/*.draft.md"
  ],
  "limit": 15,
  "outputMode": "detailed"
}
```

### Monorepo

```json
{
  "documentDirectories": [
    "./docs",
    "./packages/*/docs"
  ],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.*/**"
  ]
}
```

### Strict Search (Less Fuzzy)

```json
{
  "documentDirectories": ["./docs"],
  "fuzzy": {
    "threshold": 0.2
  }
}
```

### Extended File Types

```json
{
  "documentDirectories": ["./docs"],
  "extensions": [".md", ".markdown", ".mdx"]
}
```

---

## CLI Override Behavior

Command-line options always override config file settings:

```bash
# Uses config defaults
ccmds find "authentication"

# Overrides outputMode from config
ccmds find "authentication" -o json

# Overrides limit from config
ccmds find "authentication" -l 20

# Ignores config file entirely
ccmds find "authentication" --no-config

# Uses specific config file
ccmds find "authentication" --config ./custom.json
```

---

## Exclude Patterns

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `**/node_modules/**` | Any `node_modules` directory at any depth |
| `**/.*/**` | Hidden directories (starting with `.`) |
| `**/*.draft.md` | Files ending in `.draft.md` |
| `archive/**` | `archive` directory at project root |
| `**/temp/*` | Any file directly inside a `temp` directory |

### Common Exclude Patterns

```json
{
  "exclude": [
    "**/node_modules/**",
    "**/.*/**",
    "**/dist/**",
    "**/build/**",
    "**/vendor/**",
    "**/archive/**",
    "**/*.draft.md",
    "**/CHANGELOG.md"
  ]
}
```

### CLI Exclude Flag

Exclude patterns can also be specified via CLI (merged with config):

```bash
ccmds list ./docs -e "**/archive/**"
ccmds find "api" ./docs -e "**/drafts/**" -e "**/*.old.md"
```

---

## Viewing Configuration

```bash
# Show current effective config
ccmds config

# Show config file path
ccmds config --path

# JSON output
ccmds config -o json

# Show defaults (ignore config files)
ccmds config --no-config
```

---

## Caching

Cache search results to speed up repeated queries (disabled by default).

### Enable Caching

```json
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxEntries": 50
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable caching |
| `ttl` | `300` | Seconds until cache entry expires |
| `maxEntries` | `50` | Maximum cached queries (oldest removed when exceeded) |

### Cache Commands

```bash
# View cache statistics
ccmds cache stats

# Clear all cached entries
ccmds cache clear
```

### Skip Cache for Single Command

```bash
ccmds find "query" --no-cache
```

### What Gets Cached

- `find` results (fuzzy search)
- `grep` results (pattern search)

Cache is stored in `.ccmds-cache.json` in the project root.

---

## Context Efficiency Features

The CLI includes optimizations to reduce AI context usage by 30-50%:

### Smart Context (grep)
- **Code block preservation** - Returns full code blocks when match is inside one
- **Paragraph boundaries** - Stops at blank lines instead of arbitrary line counts
- **Heading paths** - Shows `## Setup > ### Prerequisites` for each match
- **Deduplication** - Overlapping matches are merged

### Adaptive Previews (find)
- Top 3 results: 600 characters (configurable via `preview.topResults`)
- Results 4-7: 300 characters (configurable via `preview.midResults`)
- Remaining: 150 characters (configurable via `preview.otherResults`)

### Frontmatter Filtering
Only includes useful fields by default: `title`, `description`, `tags`, `category`, `summary`, `keywords`

Customize with `frontmatterFields` in your config.

### Opt-out with --raw
Use `--raw` flag to disable optimizations if needed:
```bash
ccmds grep "pattern" ./docs --raw -c 3  # Line-based context
ccmds find "query" ./docs --raw          # Full frontmatter, fixed previews
```

---

## Recommended Documentation Structure

Organize your docs for best search results:

```
docs/
├── setup/              # Installation & setup guides
│   ├── quickstart.md
│   └── environment.md
├── api/                # API documentation
│   ├── authentication.md
│   ├── endpoints.md
│   └── webhooks.md
├── guides/             # How-to guides
│   ├── deployment.md
│   ├── testing.md
│   └── configuration.md
├── architecture/       # System design docs
│   ├── overview.md
│   ├── database.md
│   └── caching.md
├── troubleshooting/    # Common issues
│   └── faq.md
└── reference/          # Quick references
    └── env-vars.md
```

---

## Using Frontmatter

Add YAML frontmatter to your markdown files for better searchability:

```markdown
---
title: API Authentication Guide
tags: [api, auth, security, jwt, oauth]
category: api
updated: 2025-01-17
difficulty: intermediate
---

# API Authentication

Your content here...
```

Benefits:
- Better fuzzy search results (title and tags are weighted higher)
- Categorization for filtering
- Date tracking
- Related tag matching

---

## Troubleshooting

### No results found?
- Check `ccmds config` to verify your directories are correct
- Try fuzzy search (`find`) instead of exact (`grep`)
- Verify files have `.md` or `.markdown` extension

### Too many results?
- Add `-l 5` to limit results
- Add exclude patterns to your config
- Search a specific subdirectory

### Config not being used?
- Run `ccmds config --path` to see which config file is loaded
- Check for JSON syntax errors in your config file
- Ensure the config file is in the project directory or a parent

---

## Related Documentation

- **[README.md](./README.md)** - Quick start and installation
- **[skills/SKILL.md](./skills/SKILL.md)** - Claude Code skill reference
- **[rules/ccmds.mdc](./rules/ccmds.mdc)** - Cursor IDE rule reference

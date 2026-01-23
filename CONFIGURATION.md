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

The `init` command creates a `.ccmdsrc` configuration file. By default, it runs an **interactive wizard** when in a terminal (TTY).

```bash
# Interactive mode (default in terminal)
ccmds init                    # Guides you through configuration options

# Non-interactive mode
ccmds init --no-interactive   # Creates config with defaults
ccmds init -d ./docs ./wiki   # Pre-fills directories, still interactive
ccmds init --no-interactive -d ./docs  # Fully non-interactive

# Overwrite existing config
ccmds init --force            # Works with both interactive/non-interactive
```

**Interactive mode** prompts for:
1. Document directories (with option to create non-existent dirs)
2. Exclude patterns (common presets + custom)
3. Output mode
4. Advanced options (limit, fuzzy threshold, extensions, caching)

**Non-interactive mode** is used automatically when:
- Running in CI/CD pipelines (no TTY)
- Using `--no-interactive` flag
- Piping input/output

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
    "maxLines": 20,
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
| `documentDirectories` | `string[] \| object[]` | `["."]` | Directories to search (strings or named objects) |
| `exclude` | `string[]` | `[]` | Glob patterns to always exclude |
| `outputMode` | `string` | `"json"` | Default output mode |
| `limit` | `number` | `10` | Default result limit for find |
| `fuzzy.threshold` | `number` | `0.4` | Fuzzy match threshold (0=exact, 1=loose) |
| `fuzzy.weights` | `object` | See above | Field weights for search scoring |
| `preview.maxLines` | `number` | `20` | Max lines for context-aware previews |
| `preview.topResults` | `number` | `600` | Fallback preview chars for results 1-3 |
| `preview.midResults` | `number` | `300` | Fallback preview chars for results 4-7 |
| `preview.otherResults` | `number` | `150` | Fallback preview chars for remaining |
| `frontmatterFields` | `string[]` | See above | Frontmatter fields to include |
| `extensions` | `string[]` | `[".md", ".markdown"]` | File extensions to search |
| `aliases` | `object` | `{}` | Command shortcuts (planned) |
| `cache.enabled` | `boolean` | `false` | Enable result caching |
| `cache.ttl` | `number` | `300` | Cache expiration in seconds |
| `cache.maxEntries` | `number` | `50` | Maximum cached queries |
| `index.enabled` | `boolean` | `true` | Enable Fuse.js index caching |
| `index.path` | `string` | `".ccmds-fuse-index.json"` | Index file location |
| `index.autoRebuild` | `boolean` | `true` | Auto-rebuild when files change |

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

---

## Named Documentation Directories

For projects with multiple documentation sources, you can use named entries with descriptions:

### Basic Format

```json
{
  "documentDirectories": [
    "./legacy-docs",
    {
      "name": "api",
      "path": "./api-docs",
      "description": "API reference documentation"
    },
    {
      "name": "guides",
      "path": "./user-guides",
      "description": "User guides and tutorials"
    }
  ]
}
```

### Entry Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | No | Name for filtering with `--doc`. Auto-generated from path basename if not provided |
| `path` | Yes | Path to documentation directory (relative to config file) |
| `description` | No | Description shown in `ccmds docs` output |

### Listing Documentations

```bash
ccmds docs          # List all configured documentations
ccmds docs -o json  # JSON output
```

### Filtering by Documentation

Use `--doc <name>` to search only in a specific documentation:

```bash
ccmds find "authentication" --doc api     # Search only API docs
ccmds grep "function" --doc guides        # Search only guides
ccmds list --doc api                      # List files in API docs
```

The `--doc` option supports case-insensitive prefix matching:

```bash
ccmds find "auth" --doc gui    # Matches "guides"
ccmds find "auth" --doc API    # Matches "api" (case-insensitive)
```

### Name Auto-Generation

For string entries or objects without explicit names, the name is auto-generated from the directory basename:

```json
{
  "documentDirectories": [
    "./docs",           // Name: "docs"
    "../other/docs"     // Name: "docs-2" (deduplication)
  ]
}
```

### Backwards Compatibility

String entries continue to work exactly as before:

```json
{
  "documentDirectories": ["./docs", "./wiki"]
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

## Search Index (Performance)

The CLI automatically caches the Fuse.js search index to dramatically improve search performance (60-80% faster on subsequent searches).

### How It Works

1. **First search**: Builds index, saves to `.ccmds-fuse-index.json`
2. **Subsequent searches**: Loads cached index if files haven't changed
3. **Auto-invalidation**: Detects file changes via mtime hashes

### Configuration

```json
{
  "index": {
    "enabled": true,
    "path": ".ccmds-fuse-index.json",
    "autoRebuild": true
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable index caching |
| `path` | `".ccmds-fuse-index.json"` | Index file location |
| `autoRebuild` | `true` | Automatically rebuild when files change |

### Index Commands

```bash
# View index statistics
ccmds index stats

# Clear cached index
ccmds index clear

# Force rebuild index
ccmds index rebuild
```

### Force Rebuild on Search

```bash
ccmds find "query" --rebuild-index
```

### Fuse.js Performance Tuning

The default configuration includes performance optimizations:

```json
{
  "fuzzy": {
    "threshold": 0.4,
    "ignoreLocation": true,
    "ignoreFieldNorm": true,
    "distance": 100
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `ignoreLocation` | `true` | Skip location calculations (+15% speed) |
| `ignoreFieldNorm` | `true` | Skip field length normalization (+10% speed) |
| `distance` | `100` | Max character distance for matching |

### Files Created

- `.ccmds-fuse-index.json` - Serialized Fuse.js index
- `.ccmds-fuse-index-meta.json` - File hashes for invalidation

Add these to `.gitignore`:

```
.ccmds-fuse-index.json
.ccmds-fuse-index-meta.json
.ccmds-cache.json
```

---

## Context Efficiency Features

The CLI includes optimizations to reduce AI context usage by 30-50%:

### Smart Context (grep)
- **Code block preservation** - Returns full code blocks when match is inside one
- **Paragraph boundaries** - Stops at blank lines instead of arbitrary line counts
- **Heading paths** - Shows `## Setup > ### Prerequisites` for each match
- **Deduplication** - Overlapping matches are merged

### Context-Aware Previews (find)
- **Shows the actual paragraph or code block** where the search term appears
- Uses smart boundary detection (blank lines, headings, code fences)
- Preserves complete code blocks when match is inside one
- Configurable line limit via `preview.maxLines` (default: 20)
- Falls back to file start when no body match (uses `preview.topResults`/`midResults`/`otherResults`)

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

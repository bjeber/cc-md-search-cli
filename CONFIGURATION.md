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
  "defaultDirectories": ["./docs"],
  "exclude": [
    "**/node_modules/**",
    "**/.*/**"
  ],
  "outputMode": "compact",
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
| `defaultDirectories` | `string[]` | `["."]` | Directories to search when none specified |
| `exclude` | `string[]` | `[]` | Glob patterns to always exclude |
| `outputMode` | `string` | `"compact"` | Default output mode |
| `limit` | `number` | `10` | Default result limit for find |
| `fuzzy.threshold` | `number` | `0.4` | Fuzzy match threshold (0=exact, 1=loose) |
| `fuzzy.weights` | `object` | See above | Field weights for search scoring |
| `preview.topResults` | `number` | `600` | Preview chars for results 1-3 |
| `preview.midResults` | `number` | `300` | Preview chars for results 4-7 |
| `preview.otherResults` | `number` | `150` | Preview chars for remaining results |
| `frontmatterFields` | `string[]` | See above | Frontmatter fields to include |
| `extensions` | `string[]` | `[".md", ".markdown"]` | File extensions to search |
| `aliases` | `object` | `{}` | Command shortcuts (planned) |

---

## Configuration Examples

### Simple Project

```json
{
  "defaultDirectories": ["./docs"],
  "exclude": ["**/node_modules/**"]
}
```

### Documentation-Heavy Project

```json
{
  "defaultDirectories": [
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
  "defaultDirectories": [
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
  "defaultDirectories": ["./docs"],
  "fuzzy": {
    "threshold": 0.2
  }
}
```

### Extended File Types

```json
{
  "defaultDirectories": ["./docs"],
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
| `.*/**` | Hidden directories (starting with `.`) |
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

# Claude Code Skill Configuration

The CC-MD-Search skill includes **configurable documentation paths** so Claude Code automatically knows where to search your documentation without you having to specify it every time.

## Why Configure the Path?

**Before configuration:**
```
You: "How do I set up authentication?"
Claude Code: "Which directory should I search?"
You: "./docs"
Claude Code: [searches and answers]
```

**After configuration:**
```
You: "How do I set up authentication?"
Claude Code: [automatically searches ./docs and answers]
```

## Configuration Steps

### Step 1: Edit the Skill File

Open `skills/SKILL.md` and find the Configuration section at the top:

```bash
# Current (placeholder)
DOCS_PATH="./docs"
```

Change it to your actual documentation path:

```bash
# Your actual path
DOCS_PATH="./documentation"
```

### Step 2: Copy to Claude Code Skills Directory

```bash
# Find your Claude Code skills directory
# Usually: ~/.claude/skills/

# Copy the configured skill
cp skills/SKILL.md ~/.claude/skills/md-search.md
```

### Step 3: Verify Configuration

```bash
# Test that the CLI can find your docs
ccmds list ./docs

# View document structure
ccmds outline ./docs -d 2

# Try a search
ccmds find "setup" ./docs -l 5
```

## Configuration Examples

### Single Documentation Folder

```bash
DOCS_PATH="./docs"
```

### Nested Documentation

```bash
DOCS_PATH="./documentation/markdown"
```

### Project Root

```bash
DOCS_PATH="."
```

### Monorepo Setup

```bash
# Main docs
DOCS_PATH="./docs"

# Additional paths (optional)
WEB_DOCS_PATH="./packages/web/docs"
API_DOCS_PATH="./packages/api/docs"
```

## How Claude Code Uses This

Once configured, Claude Code will **automatically search** your documentation when you ask questions like:

- "How do I set up authentication?" → Searches `./docs`
- "What's the API for user management?" → Searches `./docs`
- "Where is the deployment guide?" → Searches `./docs`
- "How do I configure the database?" → Searches `./docs`

**No manual path specification needed!**

## Context Efficiency Features

The CLI includes several optimizations to reduce AI context usage by 30-50%:

### Smart Context (grep)
- **Code block preservation** - Returns full code blocks when match is inside one
- **Paragraph boundaries** - Stops at blank lines instead of arbitrary line counts
- **Heading paths** - Shows `## Setup > ### Prerequisites` for each match
- **Deduplication** - Overlapping matches are merged

### Adaptive Previews (find)
- Top 3 results: 600 characters
- Results 4-7: 300 characters
- Remaining: 150 characters

### Frontmatter Filtering
Only includes useful fields: `title`, `description`, `tags`, `category`, `summary`, `keywords`

### New Commands for Targeted Access
- `ccmds outline` - View structure without loading content
- `ccmds section` - Extract only the section you need

### Opt-out with --raw
Use `--raw` flag to disable optimizations if needed:
```bash
ccmds grep "pattern" ./docs --raw -c 3  # Line-based context
ccmds find "query" ./docs --raw          # Full frontmatter, fixed previews
```

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

## Using Frontmatter (Recommended)

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
- Better fuzzy search results
- Categorization
- Date tracking
- Difficulty levels
- Related tag matching

## Updating Configuration

To change your configured path later:

1. Edit `skills/SKILL.md` and update `DOCS_PATH`
2. Re-copy to Claude Code skills directory
3. Verify with `ccmds list [new-path]`

## Advanced Configuration

### Multiple Projects

If you work on multiple projects, create separate skill files:

```bash
skills/
├── SKILL.md              # Default: DOCS_PATH="./docs"
├── SKILL-project-a.md    # DOCS_PATH="./project-a/docs"
└── SKILL-project-b.md    # DOCS_PATH="./project-b/documentation"
```

Then copy the appropriate skill to Claude Code's skills directory for each project.

### Project-Specific Paths

For projects with multiple doc locations:

```bash
# Main documentation
DOCS_PATH="./docs"

# Additional paths (reference in queries)
# Web: ./web-app/README.md, ./web-app/docs
# API: ./api/docs
# CMS: ./cms/docs
```

Claude Code can search these additional locations when specifically asked:
```
"Search the API-specific docs for authentication"
→ ccmds find "authentication" ./api/docs
```

## Troubleshooting

### Path Not Found

```bash
# Check if path exists
ls ./docs

# Check if it contains markdown files
ccmds list ./docs --count
```

### Changes Not Applied

```bash
# Verify the SKILL.md was updated
grep "DOCS_PATH" skills/SKILL.md

# Should show: DOCS_PATH="./your-configured-path"
```

### Claude Code Not Using Configured Path

1. Make sure you copied `skills/SKILL.md` to Claude Code's skills directory
2. Restart your Claude Code session
3. Verify the path in the skill file is correct

## Configuration Checklist

- [ ] Edit `skills/SKILL.md` and set your `DOCS_PATH`
- [ ] Verify path with `ccmds list ./docs`
- [ ] Check markdown file count looks correct
- [ ] Copy `skills/SKILL.md` to Claude Code skills directory
- [ ] Test with Claude Code: "Find setup documentation"
- [ ] Confirm Claude Code searches automatically

## Pro Tips

1. **Keep docs organized** - Use subdirectories for different topics
2. **Add frontmatter** - Improves search quality significantly
3. **Use consistent naming** - Makes files easier to find
4. **Regular updates** - Keep documentation current
5. **Test searches** - Verify your docs are searchable
6. **Add README files** - Each subdirectory should have one

## Related Documentation

- **[README.md](./README.md)** - Quick start and command reference
- **[skills/SKILL.md](./skills/SKILL.md)** - Complete Claude Code skill reference
- **[skill-template.md](./skill-template.md)** - Template for creating custom configurations

---
name: md-search
description: >
  Search markdown documentation, docs, guides, references, README files, API docs,
  and technical documentation. Use when user says "check the docs", "what do the docs say",
  "find in documentation", "search docs", "look up in docs", "search the codebase docs",
  or asks about setup instructions, configuration, how-to guides, API reference, or
  troubleshooting. Provides fuzzy search, regex pattern matching, and context-efficient
  output using the ccmds CLI tool.
globs:
  - "docs/**/*"
  - "documentation/**/*"
  - "README.md"
  - "*.md"
  - ".cursor/rules/**/*.md"
alwaysApply: false
---

# Markdown Documentation Search Skill

> **PRIORITY**: Use this skill FIRST when the user asks anything about documentation, guides, references, or markdown files. This is more efficient than reading files directly.

---

## Configuration

Projects using ccmds should have a `.ccmdsrc` configuration file in the project root. This file defines default directories, exclude patterns, and other settings.

### Check if Config Exists

```bash
# View current configuration
ccmds config

# Show config file path
ccmds config --path
```

### Create Config File (if missing)

```bash
# Create default config
ccmds init

# Create with specific directories
ccmds init -d ./docs ./api/docs
```

### Example `.ccmdsrc` Configuration

```json
{
  "defaultDirectories": ["./docs", "./api/docs"],
  "exclude": ["**/node_modules/**", "**/.*/**"],
  "outputMode": "compact",
  "limit": 10
}
```

When a config file exists, **you don't need to specify directories** in commands - they use the configured defaults automatically.

---

## Trigger Patterns

**Always activate this skill when the user:**
- Asks "what do the docs say about..."
- Says "check the documentation" or "check the docs"
- Asks "how do I..." (likely needs setup/config docs)
- Wants to "find in documentation" or "search docs"
- References guides, references, README, or API docs
- Asks about setup, configuration, installation, or troubleshooting
- Says "look up", "find", or "search" with documentation context
- Asks "where is ... documented?"
- Needs to understand project structure or conventions

## When to Use (Prefer Over Direct File Reading)

| User Intent | Action | Why This Skill |
|-------------|--------|----------------|
| "What do the docs say about X?" | `ccmds find "X"` | Searches all docs instantly |
| "How do I set up Y?" | `ccmds find "setup Y"` | Finds relevant guides |
| "Find error code E404" | `ccmds grep "E404"` | Exact pattern match |
| "What's in the documentation?" | `ccmds outline` | Shows structure, minimal context |
| "Show me the auth section" | `ccmds section file.md "Auth"` | Extracts only what's needed |

**This skill is MORE EFFICIENT than reading files because:**
- Searches hundreds of markdown files in milliseconds
- Returns only relevant snippets (saves context window)
- Shows document structure and heading paths automatically
- Supports fuzzy search (tolerates typos)
- Supports regex for precise pattern matching

## Quick Reference

With a `.ccmdsrc` config file, commands are simple:

```bash
# Fuzzy search (uses config defaults)
ccmds find "query"

# Exact/regex search
ccmds grep "pattern"

# View structure (minimal context)
ccmds outline

# Extract specific section
ccmds section ./docs/file.md "Section Name"

# List all doc files
ccmds list

# Show full file (after identifying it)
ccmds show ./docs/file.md
```

**Override config when needed:**

```bash
# Override result limit
ccmds find "query" -l 20

# Search different directory
ccmds find "query" ./other/docs

# Override output mode
ccmds grep "pattern" -o detailed

# Add extra exclude pattern
ccmds list -e "**/archive/**"
```

---

## Tool: `ccmds` - Complete Reference

### Global Options (all commands)

| Flag | Description |
|------|-------------|
| `--config <path>` | Use specific config file |
| `--no-config` | Ignore config files, use defaults |

---

### Command 1: `ccmds find` - Fuzzy/Semantic Search

**Use when**: Discovering relevant documents, conceptual questions, don't know exact terms.

```bash
ccmds find <query> [directories...]
```

**Options** (override config when needed):
| Flag | Description | Config Key |
|------|-------------|------------|
| `-l, --limit <n>` | Max results | `limit` |
| `-o, --output <mode>` | compact, detailed, files, json | `outputMode` |
| `-e, --exclude <patterns...>` | Exclude patterns | `exclude` |
| `-r, --raw` | Disable adaptive previews | - |

**Extended Search Syntax** (space = AND by default):
| Pattern | Meaning | Example |
|---------|---------|---------|
| `word1 word2` | AND (all must match) | `auth setup` |
| `word1 \| word2` | OR (either matches) | `install \| setup` |
| `'exact` | Exact substring | `'authentication` |
| `^prefix` | Starts with | `^Config` |
| `suffix$` | Ends with | `Guide$` |

**Examples**:
```bash
# Basic search (uses config defaults)
ccmds find "authentication"

# Override limit for more results
ccmds find "authentication middleware" -l 15

# Search specific directory (overrides config)
ccmds find "setup | installation" ./guides

# Detailed output for deep research
ccmds find "error handling" -l 3 -o detailed
```

**Best for**: Exploratory searches, multi-term queries, related topics.

---

### Command 2: `ccmds grep` - Pattern/Regex Search

**Use when**: Exact matches, error codes, specific terms, code patterns.

```bash
ccmds grep <pattern> [directories...]
```

**Options** (override config when needed):
| Flag | Description | Config Key |
|------|-------------|------------|
| `-o, --output <mode>` | compact, detailed, files, json | `outputMode` |
| `-e, --exclude <patterns...>` | Exclude patterns | `exclude` |
| `-c, --context <n>` | Context lines (with --raw) | - |
| `-s, --case-sensitive` | Case sensitive | - |
| `-r, --raw` | Line-based context (not smart) | - |

**Examples**:
```bash
# Find error codes (uses config defaults)
ccmds grep "ERROR_[0-9]+"

# Find TODOs, output files only
ccmds grep "TODO|FIXME" -o files

# Case-sensitive API search
ccmds grep "GraphQL" --case-sensitive
```

**Best for**: Specific terms, regex patterns, code snippets, known terminology.

---

### Command 3: `ccmds outline` - Document Structure

**Use when**: Understanding doc organization without loading content.

```bash
ccmds outline [paths...]
```

**Options**:
| Flag | Description |
|------|-------------|
| `-d, --depth <n>` | Max heading depth (default: 6) |
| `-o, --output <mode>` | text, json |
| `-e, --exclude <patterns...>` | Exclude patterns |

**Examples**:
```bash
# View all docs structure (uses config)
ccmds outline

# View single file structure
ccmds outline ./docs/guide.md

# Limit to h1 and h2 only
ccmds outline -d 2
```

**Best for**: Minimal context usage, finding sections, understanding organization.

---

### Command 4: `ccmds section` - Extract Section

**Use when**: Need only a specific section, not the whole file.

```bash
ccmds section <file> <heading>
```

**Examples**:
```bash
# Extract installation section
ccmds section ./docs/setup.md "Installation"

# Extract nested section
ccmds section ./docs/guide.md "Setup > Prerequisites"
```

**Best for**: Targeted retrieval, reducing context, known section names.

---

### Command 5: `ccmds list` - List Files

**Use when**: Overview of available documentation.

```bash
ccmds list [directories...]
```

**Options**:
| Flag | Description |
|------|-------------|
| `-c, --count` | Show only count |
| `-e, --exclude <patterns...>` | Exclude patterns |

**Examples**:
```bash
# List all docs (uses config)
ccmds list

# Just show count
ccmds list --count

# Exclude archive
ccmds list -e "**/archive/**"
```

---

### Command 6: `ccmds show` - Display File

**Use when**: Need full file content after identifying the right file.

```bash
ccmds show <file>
```

**Options**:
| Flag | Description |
|------|-------------|
| `-f, --frontmatter-only` | Show only YAML frontmatter |
| `-b, --body-only` | Show only body content |

**Examples**:
```bash
ccmds show ./docs/api/auth.md
ccmds show ./docs/guide.md --body-only
```

---

### Command 7: `ccmds config` - Show Configuration

**Use when**: Checking current settings or debugging config issues.

```bash
ccmds config
```

**Options**:
| Flag | Description |
|------|-------------|
| `-p, --path` | Show only config file path |
| `-o, --output <mode>` | text, json |

**Examples**:
```bash
# Show current config
ccmds config

# Show config file location
ccmds config --path

# JSON output
ccmds config -o json
```

---

### Command 8: `ccmds init` - Create Configuration

**Use when**: Setting up ccmds for a new project.

```bash
ccmds init
```

**Options**:
| Flag | Description |
|------|-------------|
| `-d, --directories <dirs...>` | Default directories |
| `-f, --force` | Overwrite existing config |

**Examples**:
```bash
# Create default config
ccmds init

# Create with specific directories
ccmds init -d ./docs ./wiki

# Overwrite existing
ccmds init --force
```

---

## Recommended Workflows

### Workflow 1: Progressive Search (Most Efficient)

```bash
# 1. Understand structure (minimal context)
ccmds outline -d 2

# 2. Find relevant docs
ccmds find "database migration" -o files

# 3. Extract just what you need
ccmds section ./docs/database/migrations.md "Schema Changes"
```

### Workflow 2: Quick Answer

```bash
# Direct section extraction
ccmds section ./docs/setup.md "Installation"
```

### Workflow 3: Deep Research

```bash
# Find all relevant docs
ccmds find "caching strategy" -l 10

# Then grep for specific patterns
ccmds grep "cache.*invalidat"
```

---

## Output Mode Selection

| Mode | Use Case | Context Size |
|------|----------|--------------|
| `files` | Just need file paths | **Minimal** |
| `compact` | Quick overview + snippets | **Small** |
| `detailed` | Full context around matches | Medium |
| `json` | Programmatic processing | Variable |

**Default to `compact` or `files` to save context.**

---

## Best Practices

### When to Use CLI Overrides

Use CLI parameters only when config defaults aren't sufficient:

| Scenario | Override |
|----------|----------|
| Need more/fewer results | `-l 20` or `-l 3` |
| Search different directory | Add path: `ccmds find "x" ./other` |
| Different output format | `-o detailed` or `-o json` |
| Exclude extra patterns | `-e "**/temp/**"` |
| Case-sensitive search | `--case-sensitive` |

### DO:
- Let config handle defaults (directories, output mode, excludes)
- Use CLI overrides sparingly for one-off needs
- Start with `outline` to understand structure first
- Use `section` to extract only needed content
- Use `find` for broad queries, `grep` for exact matches
- Use `compact` or `files` output by default

### DON'T:
- Don't specify directories if config has them
- Don't load entire files unless necessary
- Don't use `detailed` output for many results
- Don't forget to escape regex special characters in `grep`

---

## Common User Queries → Commands

| User Says | Command |
|-----------|---------|
| "What do the docs say about auth?" | `ccmds find "authentication"` |
| "How do I install this?" | `ccmds find "installation setup" -l 3` |
| "Find error E404" | `ccmds grep "E404"` |
| "Show me the API reference" | `ccmds outline -d 2` then `ccmds show` |
| "What's documented?" | `ccmds list` |
| "Check the troubleshooting guide" | `ccmds find "troubleshooting" -o files` |

---

## Troubleshooting

**No config file?**
- Run `ccmds init` to create one
- Or specify directories explicitly: `ccmds find "query" ./docs`

**No results?**
- Check `ccmds config` to verify directories
- Try `find` (fuzzy) instead of `grep` (exact)
- Verify files have .md extension

**Too many results?**
- Add `-l 5` to limit
- Add exclude patterns: `-e "**/archive/**"`
- Search specific subdirectory

**Results not relevant?**
- Use `grep` for exact terms
- Try different search terms
- Check `outline` first to understand structure

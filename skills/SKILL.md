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

**DOCS_PATHS** (configure one or more documentation directories):
- `./docs` - Main documentation

> ⚠️ **IMPORTANT**: Edit the list above to match your project's documentation directories. You can add multiple paths to search across different documentation locations simultaneously.

### Multi-Path Examples:

**Single docs folder:**
- `./docs` - Main documentation

**Multiple documentation locations:**
- `./docs` - Main documentation
- `./api/docs` - API reference
- `./guides` - User guides

**Monorepo with multiple projects:**
- `./packages/web/docs` - Web app docs
- `./packages/api/docs` - API docs
- `./packages/shared/docs` - Shared library docs

When multiple paths are configured, pass all paths to ccmds:
```bash
ccmds find "authentication" ./docs ./api/docs ./guides -l 5
```

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
| "What's in the documentation?" | `ccmds outline ./docs` | Shows structure, minimal context |
| "Show me the auth section" | `ccmds section file.md "Auth"` | Extracts only what's needed |

**This skill is MORE EFFICIENT than reading files because:**
- Searches hundreds of markdown files in milliseconds
- Returns only relevant snippets (saves context window)
- Shows document structure and heading paths automatically
- Supports fuzzy search (tolerates typos)
- Supports regex for precise pattern matching

## Quick Reference

```bash
# Fuzzy search (single directory)
ccmds find "query" ./docs -l 5 -o compact

# Fuzzy search (multiple directories)
ccmds find "query" ./docs ./api/docs ./guides -l 5

# Exact/regex search (find specific terms)
ccmds grep "pattern" ./docs -o compact

# Grep across multiple directories
ccmds grep "pattern" ./docs ./api/docs

# View structure (minimal context)
ccmds outline ./docs -d 2

# View structure across multiple directories
ccmds outline ./docs ./api/docs -d 2

# Extract specific section
ccmds section ./docs/file.md "Section Name"

# List all doc files (single or multiple directories)
ccmds list ./docs
ccmds list ./docs ./api/docs ./guides

# Show full file (after identifying it)
ccmds show ./docs/file.md
```

---

## Tool: `ccmds` - Complete Reference

### Command 1: `ccmds find` - Fuzzy/Semantic Search

**Use when**: Discovering relevant documents, conceptual questions, don't know exact terms.

```bash
ccmds find <query> [directories...] [options]
```

**Options**:
| Flag | Description | Default |
|------|-------------|---------|
| `-l, --limit <n>` | Max results | 10 |
| `-o, --output <mode>` | compact, detailed, files, json | compact |
| `-r, --raw` | Disable adaptive previews | false |

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
# Find docs with BOTH words (AND search)
ccmds find "authentication middleware" ./docs -l 5

# Find docs with EITHER word (OR search)
ccmds find "setup | installation" ./docs -l 5

# Exact phrase match
ccmds find "'API Reference" ./docs -o files

# Detailed output for deep research
ccmds find "error handling" ./docs -l 3 -o detailed
```

**Best for**: Exploratory searches, multi-term queries, related topics.

---

### Command 2: `ccmds grep` - Pattern/Regex Search

**Use when**: Exact matches, error codes, specific terms, code patterns.

```bash
ccmds grep <pattern> [directories...] [options]
```

**Options**:
| Flag | Description | Default |
|------|-------------|---------|
| `-c, --context <n>` | Context lines (with --raw) | 2 |
| `-s, --case-sensitive` | Case sensitive | false |
| `-o, --output <mode>` | compact, detailed, files, json | compact |
| `-r, --raw` | Line-based context (not smart) | false |

**Examples**:
```bash
# Find error codes
ccmds grep "ERROR_[0-9]+" ./docs

# Find TODOs
ccmds grep "TODO|FIXME" ./docs -o files

# Case-sensitive API search
ccmds grep "GraphQL" ./docs --case-sensitive
```

**Best for**: Specific terms, regex patterns, code snippets, known terminology.

---

### Command 3: `ccmds outline` - Document Structure

**Use when**: Understanding doc organization without loading content.

```bash
ccmds outline [paths...] [options]
```

**Options**:
| Flag | Description | Default |
|------|-------------|---------|
| `-d, --depth <n>` | Max heading depth | 6 |
| `-o, --output <mode>` | text, json | text |

**Examples**:
```bash
# View single file structure
ccmds outline ./docs/guide.md

# View all docs (h1 and h2 only)
ccmds outline ./docs -d 2
```

**Best for**: Minimal context usage, finding sections, understanding organization.

---

### Command 4: `ccmds section` - Extract Section

**Use when**: Need only a specific section, not the whole file.

```bash
ccmds section <file> <heading> [options]
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
ccmds list [directories...] [options]
```

**Options**:
| Flag | Description |
|------|-------------|
| `-c, --count` | Show only count |

**Examples**:
```bash
ccmds list ./docs
ccmds list ./docs --count
```

---

### Command 6: `ccmds show` - Display File

**Use when**: Need full file content after identifying the right file.

```bash
ccmds show <file> [options]
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

## Recommended Workflows

### Workflow 1: Progressive Search (Most Efficient)

```bash
# 1. Understand structure (minimal context)
ccmds outline ./docs -d 2

# 2. Find relevant docs
ccmds find "database migration" ./docs -o files

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
ccmds find "caching strategy" ./docs -l 10 -o compact

# Then grep for specific patterns
ccmds grep "cache.*invalidat" ./docs -o compact
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

### ✅ DO:
- **Replace `./docs` in all commands with your configured `DOCS_PATH`**
- Start with `outline` to understand structure first
- Use `section` to extract only needed content
- Use `find` for broad queries, `grep` for exact matches
- Use `compact` or `files` output by default
- Limit results with `-l` flag
- Search specific subdirectories when possible

### ❌ DON'T:
- Don't load entire files unless necessary
- Don't use `detailed` output for many results
- Don't search everything when topic is localized
- Don't forget to escape regex special characters in `grep`

---

## Common User Queries → Commands

| User Says | Command |
|-----------|---------|
| "What do the docs say about auth?" | `ccmds find "authentication" ./docs -o compact` |
| "How do I install this?" | `ccmds find "installation setup" ./docs -l 3` |
| "Find error E404" | `ccmds grep "E404" ./docs` |
| "Show me the API reference" | `ccmds outline ./docs/api -d 2` then `ccmds show` |
| "What's documented?" | `ccmds list ./docs` |
| "Check the troubleshooting guide" | `ccmds find "troubleshooting" ./docs -o files` |

---

## Troubleshooting

**No results?**
- **Verify `DOCS_PATH` is configured correctly at the top of this file**
- Try `find` (fuzzy) instead of `grep` (exact)
- Check directory path exists
- Verify files have .md extension

**Too many results?**
- Add `-l 5` to limit
- Search specific subdirectory
- Use `grep` for exact matches

**Results not relevant?**
- Use `grep` for exact terms
- Try different search terms
- Check `outline` first to understand structure
---
name: ccmds
description: >
  Search markdown documentation efficiently. Use when user asks about docs,
  guides, setup, configuration, API reference, or says "check the docs".
  Provides fuzzy search, regex matching, and section extraction.
globs:
  - "docs/**/*"
  - "documentation/**/*"
  - "README.md"
  - "*.md"
alwaysApply: false
---

# ccmds - Documentation Search

> Use this skill when user asks about documentation. More efficient than reading files directly.

## When to Activate

- "What do the docs say about..."
- "Check the documentation" / "check the docs"
- "How do I..." (setup/config questions)
- "Find in documentation" / "search docs"
- Questions about setup, configuration, installation, API

## First: Check Configuration

```bash
ccmds config          # View current config
ccmds init            # Create .ccmdsrc if missing
```

With a `.ccmdsrc` config file, commands use project defaults automatically.

## Command Decision Guide

| User Intent | Command | Why |
|-------------|---------|-----|
| Conceptual question, don't know exact terms | `ccmds find "query"` | Fuzzy search |
| Exact term, error code, pattern | `ccmds grep "pattern"` | Regex match |
| Understand doc structure | `ccmds outline` | Headings only, minimal context |
| Need specific section | `ccmds section file.md "Heading"` | Targeted extraction |
| See what docs exist | `ccmds list` | File listing |
| Read full file (after finding it) | `ccmds show file.md` | Full content |

## Basic Syntax

```bash
ccmds find "authentication"           # Fuzzy search
ccmds grep "ERROR_[0-9]+"             # Regex search
ccmds outline                         # Show structure
ccmds section ./docs/setup.md "Install"  # Extract section
ccmds list                            # List files
ccmds show ./docs/api.md              # Show file
```

## Output Modes

| Mode | Use | Context |
|------|-----|---------|
| `files` | Just need paths | Minimal |
| `compact` | Overview + snippets | Small |
| `detailed` | Full context | Medium |

Default: `compact`. Use `-o files` for minimal context.

## Common Overrides

```bash
ccmds find "query" -l 5              # Limit results
ccmds find "query" ./other/docs      # Different directory
ccmds grep "pattern" -o files        # Files only output
ccmds list -e "**/archive/**"        # Exclude pattern
```

## Recommended Workflow

1. `ccmds outline -d 2` - Understand structure (minimal context)
2. `ccmds find "topic"` - Find relevant docs
3. `ccmds section file.md "Section"` - Extract what you need

---

**For detailed documentation:**
- [Command Reference](./ccmds-commands.md) - Full options for all commands
- [Examples & Workflows](./ccmds-examples.md) - Common patterns and use cases
- [Configuration](./ccmds-config.md) - Config file schema and patterns

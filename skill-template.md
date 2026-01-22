---
name: ccmds
description: This skill enables efficient searching of markdown documentation using the ccmds CLI. Use this skill when the user asks about documentation, needs to find information across many markdown files, or wants to discover content without knowing exact file names. Provides fuzzy search, regex pattern matching, and context-efficient output modes.
---

# Markdown Search CLI Skill - Configuration Template

## ⚙️ CONFIGURATION - EDIT THIS SECTION

**IMPORTANT: Configure your documentation paths here before using this skill:**

**DOCS_PATHS** (configure one or more documentation directories):
- `./docs` - Main documentation
- `./api/docs` - API reference (optional)
- `./guides` - User guides (optional)

> Remove paths you don't need. At least one path is required.

### Configuration Examples:

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
ccmds grep "TODO" ./docs ./api/docs
ccmds list ./docs ./api/docs ./guides
```

### Auto-Search Behavior:

When configured, Claude Code will **automatically search** the configured `DOCS_PATHS` when the user asks questions about:
- Setup, installation, configuration
- API endpoints, usage
- Architecture, design decisions
- Troubleshooting, debugging
- Guides, tutorials, how-tos
- Any project documentation

**No need to ask** - just search immediately using the configured path.

### Context Efficiency Features:

The CLI includes optimizations to reduce context usage by 30-50%:
- **Smart context** - Preserves code blocks and paragraph boundaries
- **Heading paths** - Shows document structure for each match
- **Adaptive previews** - Top results get more content automatically
- **New commands** - `outline` (view structure) and `section` (extract specific sections)

### Extended Search Syntax:

The `find` command supports advanced search patterns:
- **AND**: `word1 word2` (space-separated, all must match)
- **OR**: `word1 | word2` (pipe-separated, either matches)
- **Exact**: `'phrase` (single quote prefix for exact substring)
- **Prefix**: `^Start` (caret for starts-with)
- **Suffix**: `End$` (dollar for ends-with)

---

## 📋 Quick Start Checklist

Before using this skill:
- [ ] Edit `DOCS_PATHS` above with your actual documentation directories
- [ ] Verify the paths exist: `ls ./docs` (for each configured path)
- [ ] Test the search: `ccmds list ./docs` (or with all your paths)
- [ ] View structure: `ccmds outline ./docs -d 2`
- [ ] Remove any paths you don't need from `DOCS_PATHS`
- [ ] Save this file to your Claude Code skills directory

---

Once configured, see the full SKILL.md file for:
- Complete command reference (6 commands: find, grep, list, show, outline, section)
- Workflow strategies
- Output mode selection
- Best practices
- Example interactions

**After configuration, copy your configured DOCS_PATHS list to the main SKILL.md file.**
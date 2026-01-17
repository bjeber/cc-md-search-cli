# Documentation Path Configuration Guide

## Overview

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

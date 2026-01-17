---
name: md-search
description: This skill enables efficient searching of markdown documentation using the ccmds CLI. Use this skill when the user asks about documentation, needs to find information across many markdown files, or wants to discover content without knowing exact file names. Provides fuzzy search, regex pattern matching, and context-efficient output modes.
---

# Markdown Search CLI Skill

## Overview
This skill enables efficient searching of markdown documentation databases using the `ccmds` CLI tool. Use this to find relevant information in large documentation sets without loading entire files into context.

## When to Use
- User asks about documentation, guides, or references
- Need to find specific information across many files
- Want to discover related content without knowing exact file names
- Need to minimize context usage when working with large doc bases

## Tool: `ccmds`

### Available Commands

#### 1. `ccmds find <query> [directory]` - Fuzzy/Semantic Search
**Use when**: You need to discover relevant documents but don't know exact terms.

**Options**:
- `-l, --limit <number>`: Max results (default: 10)
- `-o, --output <mode>`: Output format (compact, detailed, files, json)

**Examples**:
```bash
# Find docs about authentication
ccmds find "user authentication" ./docs -l 5 -o compact

# Discover deployment guides
ccmds find "deploy production" ./docs -o files
```

**Best for**:
- Exploratory searches
- Finding related topics
- When user's question is conceptual
- Tolerant of typos/variations

#### 2. `ccmds grep <pattern> [directory]` - Pattern/Regex Search
**Use when**: You need exact matches or specific patterns.

**Options**:
- `-c, --context <lines>`: Lines of context (default: 2)
- `-s, --case-sensitive`: Case sensitive matching
- `-o, --output <mode>`: Output format

**Examples**:
```bash
# Find exact error codes
ccmds grep "ERROR_[0-9]+" ./docs -c 3

# Find all TODO items
ccmds grep "TODO|FIXME" ./docs -o files

# Case-sensitive API search
ccmds grep "GraphQL" ./docs --case-sensitive
```

**Best for**:
- Finding specific terms/codes
- Regex pattern matching
- Code snippets or examples
- Known terminology

#### 3. `ccmds list [directory]` - List Files
**Use when**: You need an overview of available documentation.

**Options**:
- `-c, --count`: Show only count

**Examples**:
```bash
# List all markdown files
ccmds list ./docs

# Count files
ccmds list ./docs --count
```

#### 4. `ccmds show <file>` - Display File
**Use when**: You've identified the right file and need full content.

**Options**:
- `-f, --frontmatter-only`: Show only YAML frontmatter
- `-b, --body-only`: Show only body content

**Examples**:
```bash
# Show full file
ccmds show ./docs/api/auth.md

# Show only metadata
ccmds show ./docs/guides/setup.md --frontmatter-only
```

## Workflow Strategies

### Strategy 1: Progressive Search
1. Start with `find` to discover relevant docs (compact output)
2. Use `grep` on specific files/directories for details
3. Use `show` only when you've identified the exact file needed

```bash
# Step 1: Discover
ccmds find "database migration" ./docs -o files

# Step 2: Narrow down (if needed)
ccmds grep "migration.*schema" ./docs/database -c 5

# Step 3: Read specific file
ccmds show ./docs/database/migrations.md
```

### Strategy 2: Quick Answer
For simple lookups, combine commands:

```bash
# Find and show the top result
ccmds find "installation steps" ./docs -l 1 -o files | xargs ccmds show
```

### Strategy 3: Comprehensive Research
For complex questions requiring multiple sources:

```bash
# Find all relevant docs
ccmds find "error handling" ./docs -l 10 -o json > results.json

# Then grep for specific patterns across those files
ccmds grep "catch.*Error" ./docs/api ./docs/guides -o compact
```

## Output Mode Selection

Choose output mode based on context needs:

| Mode | Use Case | Context Size |
|------|----------|--------------|
| `files` | Just need file paths | Minimal |
| `compact` | Quick overview + snippets | Small |
| `detailed` | Need full context around matches | Medium |
| `json` | Programmatic processing | Variable |

## Best Practices

### ✅ DO:
- Start with `find` for broad queries
- Use `compact` output by default
- Limit results to stay within context (`-l` flag)
- Use `files` output when just identifying sources
- Chain commands for efficiency
- Search specific subdirectories when possible

### ❌ DON'T:
- Don't load entire files unless necessary
- Don't use `detailed` output for many results
- Don't search everything when topic is localized
- Don't ignore frontmatter (may contain useful metadata)
- Don't forget regex special characters need escaping in `grep`

## Example User Interactions

### Example 1: Finding Setup Instructions
**User**: "How do I set up the development environment?"

**Approach**:
```bash
ccmds find "development environment setup" ./docs -l 3 -o compact
```

### Example 2: Looking for API Endpoints
**User**: "What are the authentication endpoints?"

**Approach**:
```bash
# First find API docs
ccmds find "authentication endpoints" ./docs/api -l 5 -o files

# Then grep for specific patterns
ccmds grep "POST|GET.*auth" ./docs/api -c 2
```

### Example 3: Finding Error Codes
**User**: "What does error code E404 mean?"

**Approach**:
```bash
ccmds grep "E404" ./docs -c 5 -o compact
```

### Example 4: Research Topic
**User**: "Tell me everything about caching strategies"

**Approach**:
```bash
# Discover all caching docs
ccmds find "caching strategy" ./docs -l 5 -o compact

# Review, then show most relevant
ccmds show ./docs/architecture/caching.md
```

## Integration Tips

### For Claude Code Users:
1. **Set up alias** in your project directory
2. **Document location**: Tell Claude where docs are (`./docs`, `./documentation`, etc.)
3. **Use in skill**: Reference this skill in your Claude Code configuration
4. **Combine with context**: Use search results to decide what to load fully

### Configuration Example:
```json
{
  "tools": {
    "ccmds": {
      "command": "ccmds",
      "docs_path": "./docs"
    }
  }
}
```

## Performance Notes

- **Fast**: Searches hundreds of files in milliseconds
- **Memory efficient**: Streams file reading
- **Regex cache**: Pattern compilation is optimized
- **Fuzzy search**: Fuse.js provides quick relevance scoring

## Troubleshooting

**No results found?**
- Try fuzzy search (`find`) instead of exact (`grep`)
- Check directory path
- Verify file extensions (.md or .markdown)

**Too many results?**
- Use `-l` to limit
- Search in specific subdirectory
- Make query more specific
- Use `grep` instead of `find`

**Results not relevant?**
- Use `grep` for exact matches
- Check frontmatter with `--frontmatter-only`
- Try different search terms

## Summary

The `ccmds` CLI is designed for **efficient documentation search** with **minimal context usage**. Use progressive discovery (`find` → `grep` → `show`) to navigate large doc bases intelligently.
# CC-MD-Search-CLI

**Claude Code Markdown Search - Efficient documentation search CLI for Claude Code integration**

Fast, context-efficient markdown documentation search tool designed for [Claude Code](https://claude.ai/claude-code). Quickly find relevant information across large documentation sets without loading entire files into context.

## Features

- **Fuzzy Search** - Find relevant docs even with typos or variations
- **Pattern/Regex Search** - Exact matches with regex support
- **Frontmatter Aware** - Parses YAML metadata for better search
- **Multiple Output Modes** - compact, detailed, files, json
- **Claude Code Skill** - Pre-built skill template for AI integration
- **Context Efficient** - Minimize token usage when searching docs

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- npm or pnpm

### Install

```bash
# Clone the repository
git clone https://github.com/bjeber/cc-md-search-cli.git
cd cc-md-search-cli

# Install dependencies
bun install
# or: npm install

# Link the CLI globally
npm link
```

After linking, the `ccmds` command will be available globally.

## Quick Start

```bash
# List all markdown files in a directory
ccmds list ./docs

# Fuzzy search for relevant documents
ccmds find "authentication" ./docs -l 5

# Pattern search with regex
ccmds grep "TODO|FIXME" ./docs -c 3

# Show a specific file
ccmds show ./docs/api/auth.md
```

## Commands

### `ccmds find <query> [directory]` - Fuzzy Search

Find relevant documents using fuzzy matching. Great for exploratory searches.

```bash
ccmds find "user authentication" ./docs -l 5 -o compact
ccmds find "deploy production" ./docs -o files
```

**Options:**
- `-l, --limit <number>` - Maximum results (default: 10)
- `-o, --output <mode>` - Output format: compact, detailed, files, json

### `ccmds grep <pattern> [directory]` - Pattern Search

Search for exact text patterns with regex support.

```bash
ccmds grep "ERROR_[0-9]+" ./docs -c 3
ccmds grep "GraphQL" ./docs --case-sensitive
```

**Options:**
- `-c, --context <lines>` - Lines of context around matches (default: 2)
- `-s, --case-sensitive` - Case sensitive search
- `-o, --output <mode>` - Output format

### `ccmds list [directory]` - List Files

List all markdown files in a directory.

```bash
ccmds list ./docs
ccmds list ./docs --count
```

**Options:**
- `-c, --count` - Show only file count

### `ccmds show <file>` - Display File

Show the full content of a markdown file.

```bash
ccmds show ./docs/api/auth.md
ccmds show ./docs/guide.md --frontmatter-only
ccmds show ./docs/guide.md --body-only
```

**Options:**
- `-f, --frontmatter-only` - Show only YAML frontmatter
- `-b, --body-only` - Show only body content

## Claude Code Integration

To use this tool with Claude Code, install the skill to your Claude Code skills directory.

### 1. Install the Skill

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/md-search

# Copy the skill file
cp skills/SKILL.md ~/.claude/skills/md-search/SKILL.md
```

### 2. Use with Claude Code

Once installed, the skill will be available as `/md-search`. Claude Code can automatically search your documentation when you ask questions:

- "How do I set up authentication?"
- "What are the API endpoints?"
- "Where is the deployment guide?"

Claude will use `ccmds` to search your documentation with minimal context usage.

### 3. Skill Structure

The skill follows Claude Code's skill format:

```
~/.claude/skills/md-search/
└── SKILL.md          # Skill definition with YAML frontmatter
```

The SKILL.md includes:
- **YAML frontmatter** with `name` and `description` for skill registration
- **Command reference** for all `ccmds` commands
- **Workflow strategies** for efficient documentation search
- **Best practices** for context-efficient searches

## Output Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `files` | File paths only | Quick overview, piping to other commands |
| `compact` | Paths + snippets | Default, balanced context |
| `detailed` | Full context | Deep investigation |
| `json` | JSON output | Programmatic processing |

## Workflow Tips

### Progressive Search

1. Start broad with `find` to discover relevant docs
2. Narrow down with `grep` for specific patterns
3. Use `show` to read the exact file you need

```bash
# Discover
ccmds find "database" ./docs -o files

# Narrow down
ccmds grep "migration" ./docs/database -c 5

# Read specific file
ccmds show ./docs/database/migrations.md
```

### Quick Lookup

```bash
# Find and show top result
ccmds find "installation" ./docs -l 1 -o files | xargs ccmds show
```

## Documentation Structure (Recommended)

For best search results, organize your docs with clear structure:

```
docs/
├── setup/              # Installation & setup
├── api/                # API documentation
├── guides/             # How-to guides
├── architecture/       # System design
├── troubleshooting/    # Common issues
└── reference/          # Quick references
```

### Frontmatter

Add YAML frontmatter for better search relevance:

```markdown
---
title: API Authentication Guide
tags: [api, auth, security]
category: api
---

# API Authentication
...
```

## Configuration

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration options.

## License

MIT License - see [LICENSE](./LICENSE) file.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

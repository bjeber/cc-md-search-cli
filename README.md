![CC-MD-Search-CLI](assets/header.png)

# CC-MD-Search-CLI

**A documentation search CLI designed for AI coding assistants**

CC-MD-Search-CLI (`ccmds`) helps AI coding assistants like [Claude Code](https://claude.ai/claude-code) and [Cursor](https://cursor.com) search your project's markdown documentation efficiently. Instead of loading entire files into context, the AI can search, extract specific sections, and get exactly what it needs.

## Why Use This?

When an AI coding assistant needs to reference your documentation:

| Without ccmds                          | With ccmds                                  |
| -------------------------------------- | ------------------------------------------- |
| Loads entire files into context        | Searches and returns only relevant snippets |
| Uses many tokens on irrelevant content | Minimal context usage                       |
| May miss information across files      | Searches all docs instantly                 |

**Result:** Faster responses, lower token usage, better answers.

## Quick Start

### 1. Install

```bash
# Using Bun (recommended)
bun add -g cc-md-search-cli

# Or using npm
npm i -g cc-md-search-cli
```

### 2. Configure Your Project

```bash
cd your-project
ccmds init
```

This runs an interactive wizard that creates a `.ccmdsrc` configuration file in the current directory. It guides you through setting up your documentation directories and search preferences.

#### Project-Level Agent Instructions

Add ccmds guidance to your project's `CLAUDE.md` or `AGENTS.md` file:

```markdown
## Documentation Searches

When users ask about documentation, guides, setup, or API reference:

- Use the `ccmds` skill for efficient markdown documentation search
- Supports fuzzy search, regex matching, and section extraction

**Available Documentations:**
- `api` - API reference and endpoints
- `guides` - User guides and tutorials

Use `--doc <name>` to search specific documentation (e.g., `ccmds find "auth" --doc api`).
```

This ensures AI assistants know to use ccmds when you ask documentation questions.

### 3. Set Up Your AI Assistant

**For Claude Code:**

```bash
mkdir -p ~/.claude/skills/ccmds
cp $(npm root -g)/cc-md-search-cli/skills/*.md ~/.claude/skills/ccmds/
```

**For Cursor:**

```bash
mkdir -p .cursor/rules
cp $(npm root -g)/cc-md-search-cli/rules/ccmds.mdc .cursor/rules/
```

Now when you ask your AI assistant about documentation, it will use `ccmds` automatically.

## How It Works

Once configured, your AI assistant can:

```bash
# Find relevant docs (fuzzy search)
ccmds find "authentication"

# Search for exact patterns
ccmds grep "API_KEY"

# View document structure
ccmds outline

# Extract a specific section
ccmds section ./docs/setup.md "Installation"
```

The AI uses these commands behind the scenes when you ask questions like:

- "How do I set up authentication?"
- "What are the API endpoints?"
- "Where is the deployment guide?"

## Features

- **Fuzzy Search** - Find docs even with typos or variations
- **Pattern/Regex Search** - Exact matches with regex support
- **Smart Context** - Returns code blocks and paragraphs intact
- **Section Extraction** - Fetch specific sections by heading
- **Document Outlines** - View structure without loading content
- **Project Configuration** - `.ccmdsrc` config file per project
- **Context Efficient** - Designed to minimize AI token usage

## Commands

| Command                          | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `ccmds find <query>`             | Fuzzy search for relevant documents     |
| `ccmds grep <pattern>`           | Regex/pattern search with smart context |
| `ccmds list`                     | List all markdown files                 |
| `ccmds outline`                  | Show document structure (headings only) |
| `ccmds section <file> <heading>` | Extract a specific section              |
| `ccmds show <file>`              | Display full file content               |
| `ccmds docs`                     | List all configured documentations      |
| `ccmds config`                   | Show current configuration              |
| `ccmds init`                     | Create configuration file               |
| `ccmds update`                   | Update to latest version                |

**Common options:**

- `-l, --limit <n>` - Limit results
- `-o, --output <mode>` - Output format: compact, detailed, files, json
- `-e, --exclude <patterns>` - Exclude patterns (glob syntax)
- `--doc <name>` - Search only in named documentation

See `ccmds --help` or `ccmds <command> --help` for full options.

## Configuration

Create a `.ccmdsrc` file in your project root:

```bash
ccmds init              # Interactive wizard (in terminal)
ccmds init -d ./docs    # Pre-fill directories
ccmds init --no-interactive  # Skip wizard, use defaults
```

Example configuration:

```json
{
  "documentDirectories": ["./docs"],
  "exclude": ["**/node_modules/**", "**/.*/**"],
  "outputMode": "json",
  "limit": 10
}
```

With a config file, commands use your defaults automatically - no need to specify directories each time.

### Named Documentation Directories

Configure multiple documentation sources with names and descriptions for easier filtering:

```json
{
  "documentDirectories": [
    { "name": "api", "path": "./api-docs", "description": "API reference" },
    { "name": "guides", "path": "./guides", "description": "User guides" }
  ]
}
```

Then search specific docs:

```bash
ccmds find "authentication" --doc api    # Search only API docs
ccmds docs                               # List all configured docs
```

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed options including fuzzy search tuning, preview lengths, and exclude patterns.

## Installation Options

### Bun (Recommended)

```bash
bun add -g cc-md-search-cli
```

### NPM

```bash
npm i -g cc-md-search-cli
```

### Clone Repository

```bash
git clone https://github.com/bjeber/cc-md-search-cli.git
cd cc-md-search-cli
bun install
npm link
```

## Updating

Check for and install updates:

```bash
# Check if update available
ccmds update --check

# Update to latest version
ccmds update
```

Or update manually:

```bash
# Using Bun
bun update -g cc-md-search-cli

# Using npm
npm update -g cc-md-search-cli
```

## AI Assistant Integration

### Claude Code

1. Copy the skill files to your Claude Code skills directory:

   ```bash
   mkdir -p ~/.claude/skills/ccmds
   cp skills/*.md ~/.claude/skills/ccmds/
   ```

2. Claude Code will automatically use `ccmds` when you ask about documentation.

The skill includes a slim main file (~90 lines) plus reference docs that load on-demand.

### Cursor IDE

1. Copy the rule file to your project:

   ```bash
   mkdir -p .cursor/rules
   cp rules/ccmds.mdc .cursor/rules/
   ```

2. Cursor will automatically include this rule when you ask about documentation.

Both integrations include command references, workflow strategies, and best practices for context-efficient searches.

## Documentation Tips

For best search results:

**Use clear structure:**

```
docs/
├── setup/           # Installation & setup
├── api/             # API documentation
├── guides/          # How-to guides
└── troubleshooting/ # Common issues
```

**Add frontmatter:**

```markdown
---
title: API Authentication Guide
tags: [api, auth, security]
---
```

## License

MIT License - see [LICENSE](./LICENSE) file.

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2026-01-22

### Added

- **Configuration file support** - `.ccmdsrc` files for project-specific settings
- **Hierarchical config lookup** - Project → parent directories → home directory → defaults
- **`init` command** - Create `.ccmdsrc` config files with `ccmds init`
- **`config` command** - View current effective configuration and file path
- **Exclude pattern support** - Glob patterns to exclude files/directories
- **Result caching** - Optional caching for `find` and `grep` results
- **`cache` command** - `ccmds cache stats` and `ccmds cache clear`
- **`--no-cache` flag** - Skip cache for individual commands
- **Modular skills documentation** - Split into SKILL.md + reference sub-files
- **Named documentation support** - `normalizeDocumentDirectories` and `resolveDirectories` functions for named doc entries with `--doc` prefix filtering
- **Project-level agent instructions** - README now includes example `CLAUDE.md` setup for AI assistants

### Changed

- **Rebranded to ccmds** - Skills and rules renamed from md-search to ccmds
- **Default output mode** - Changed from `compact` to `json` for better AI consumption
- **JSON output optimized** - Compact format with no whitespace, rounded scores
- **README reorganized** - Focused on AI assistant use case at top
- **Cursor rule renamed** - `docs-search.mdc` → `ccmds.mdc`
- **Skills structure** - Slim SKILL.md (~90 lines) with detailed sub-files:
  - `ccmds-commands.md` - Full command reference
  - `ccmds-examples.md` - Workflows and patterns
  - `ccmds-config.md` - Configuration schema
- **Test suite refactored** - Split monolithic `cli.test.js` into focused test files.
- **Code style improvements** - Consistent formatting with trailing commas and better line breaks

### Fixed

- Glob pattern matching for exclude patterns (recursive matching)
- **`--no-config` flag** - Fixed Commander.js option parsing (was setting `options.config = false` instead of `options.noConfig = true`)

## [1.0.2] - 2026-01-17

### Changed

- Reorganized installation section with grouped options (Bun, NPM, Clone Repository)
- Added package location paths for each installation method
- Added guidance for locating skill and rule template files
- Clarified automatic CLI registration for global installs

### Fixed

- Fixed missing `-g` flag for npm global install command

### Added

- Header image to README

## [1.0.1] - 2026-01-17

### Added

- New `outline` command - show document structure (headings only) without loading content
- New `section` command - extract specific sections by heading name
- New `grep` command alias - regex pattern matching with smart context
- Smart context extraction - preserves code blocks and respects paragraph boundaries
- Heading path display (e.g., `## Setup > ### Prerequisites`) for grep matches
- Adaptive preview lengths for search results (600/300/150 chars based on rank)
- Frontmatter filtering - only includes useful fields (title, description, tags, etc.)
- `--raw` flag to disable context optimizations when needed
- Multi-directory search support
- New `CONFIGURATION.md` guide for documentation path setup
- Cursor rules file (`rules/ccmds.mdc`) for IDE integration
- Comprehensive test suite with 1900+ lines of tests
- Test fixtures for various markdown scenarios

### Changed

- Shebang changed from `node` to `bun` for improved performance
- Enhanced skill file with detailed usage examples and context-efficient patterns
- Expanded README with full command reference and examples
- Improved skill template for easier customization

### Fixed

- Context deduplication for overlapping grep matches

## [1.0.0] - 2026-01-17

### Added

- Initial release of Claude Code Markdown Search CLI
- Fuzzy search functionality using Fuse.js for flexible text matching
- Regex pattern matching support for precise searches
- Recursive directory scanning for markdown files
- YAML frontmatter parsing via gray-matter
- Multiple output formats: `plain`, `json`, `minimal`
- Context-efficient output designed for AI assistant integration
- Support for `.md` and `.mdx` file extensions
- CLI commands: `search`, `list`, `stats`
- Configurable search options (depth, limit, threshold)
- Claude Code skill integration (`ccmds`)

[1.0.3]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/bjeber/cc-md-search-cli/releases/tag/v1.0.0

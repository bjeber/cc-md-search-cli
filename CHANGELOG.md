# Changelog

All notable changes to this project will be documented in this file.

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
- Cursor rules file (`rules/docs-search.mdc`) for IDE integration
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
- Claude Code skill integration (`md-search`)

[1.0.2]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/bjeber/cc-md-search-cli/releases/tag/v1.0.0

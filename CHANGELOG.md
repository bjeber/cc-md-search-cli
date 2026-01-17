# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-01-17

### Changed
- Updated README with improved documentation
- Enhanced skill files for better Claude Code integration

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

[Unreleased]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/bjeber/cc-md-search-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/bjeber/cc-md-search-cli/releases/tag/v1.0.0

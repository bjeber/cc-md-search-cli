#!/usr/bin/env bun

/**
 * Claude Code Markdown Search CLI
 * Main CLI orchestration - imports all functionality from modules
 */

import { Command } from 'commander';
import { existsSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { realpathSync } from 'fs';

// Import from modules
import {
  // Configuration
  DEFAULT_CONFIG,
  loadConfig,
  resolveDirectories,
  generateDefaultConfig,
  formatOutputPath,

  // Files
  findMarkdownFiles,
  findMarkdownFilesFromDirs,

  // Parsing
  parseMarkdownFile,
  extractHeadings,
  extractSection,

  // Cache
  generateCacheKey,
  getCachedResult,
  setCachedResult,
  clearCache,
  getCacheStats,

  // Index Persistence
  buildOrLoadIndex,
  clearIndexCache,
  getIndexStats,

  // Search
  grepSearch,
  fuzzySearch,

  // Output
  formatOutput,

  // Version
  checkForUpdate,
  handleVersionFlag,
} from './index.js';

import { runInteractiveInit } from './init/index.js';

const program = new Command();

// ============================================================================
// Main CLI
// ============================================================================

program
  .name('ccmds')
  .description(
    'Claude Code Markdown Search - CLI for efficient document searching and discovery'
  )
  .option('--config <path>', 'Path to config file')
  .option('--no-config', 'Ignore config file')
  .option('--no-cache', 'Skip cache for this command')
  .option('--clear-cache', 'Clear index cache before running command');

program
  .command('grep')
  .description('Search for exact text patterns (regex supported)')
  .argument('<query>', 'Search query (regex pattern)')
  .argument('[directories...]', 'Directories to search')
  .option('-c, --context <lines>', 'Lines of context around matches', '2')
  .option('-s, --case-sensitive', 'Case sensitive search', false)
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json')
  .option('-r, --raw', 'Disable smart context (use line-based context)', false)
  .option('-l, --limit <number>', 'Maximum files to return')
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .option('--doc <name>', 'Search only in named documentation (prefix match)')
  .action((query, directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);

    // Clear cache if requested
    if (globalOpts.clearCache) {
      clearIndexCache(config);
    }

    const dirs = resolveDirectories(directories, config, options.doc);
    const outputMode = options.output || config.outputMode;

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || []),
    ];

    // Check cache (use resolved paths for cache key)
    const cacheKey = generateCacheKey('grep', {
      query,
      dirs: dirs.map((d) => d.resolvedPath).sort(),
      caseSensitive: options.caseSensitive,
      exclude: excludePatterns.sort(),
    });
    let results = getCachedResult(config, cacheKey);

    if (!results) {
      const files = findMarkdownFilesFromDirs(dirs, {
        exclude: excludePatterns,
        extensions: config.extensions,
      });

      results = grepSearch(files, query, {
        context: parseInt(options.context),
        caseSensitive: options.caseSensitive,
        raw: options.raw,
        config,
      });

      setCachedResult(config, cacheKey, 'grep', results);
    }

    // Apply limit if specified
    const limit = options.limit ? parseInt(options.limit) : null;
    const limitedResults = limit ? results.slice(0, limit) : results;

    console.log(formatOutput(limitedResults, outputMode));
    console.log(
      `\n✓ Found ${results.length} file(s) with matches${limit && results.length > limit ? ` (showing ${limit})` : ''}`
    );
  });

program
  .command('find')
  .description('Fuzzy search for relevant documents')
  .argument('<query>', 'Search query')
  .argument('[directories...]', 'Directories to search')
  .option('-l, --limit <number>', 'Maximum results to return')
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json')
  .option(
    '-r, --raw',
    'Disable adaptive previews and frontmatter filtering',
    false
  )
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .option('--doc <name>', 'Search only in named documentation (prefix match)')
  .option('--rebuild-index', 'Force rebuild of search index', false)
  .action(async (query, directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);

    // Clear cache if requested
    if (globalOpts.clearCache) {
      clearIndexCache(config);
    }

    const dirs = resolveDirectories(directories, config, options.doc);
    const outputMode = options.output || config.outputMode;
    const limit = options.limit ? parseInt(options.limit) : config.limit;

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || []),
    ];

    // Check cache (use resolved paths for cache key)
    const cacheKey = generateCacheKey('find', {
      query,
      dirs: dirs.map((d) => d.resolvedPath).sort(),
      limit,
      exclude: excludePatterns.sort(),
    });
    let results = getCachedResult(config, cacheKey);

    if (!results) {
      const files = findMarkdownFilesFromDirs(dirs, {
        exclude: excludePatterns,
        extensions: config.extensions,
      });

      results = await fuzzySearch(files, query, {
        limit,
        raw: options.raw,
        config,
        rebuildIndex: options.rebuildIndex || globalOpts.clearCache,
      });

      setCachedResult(config, cacheKey, 'find', results);
    }

    console.log(formatOutput(results, outputMode));
    console.log(`\n✓ Found ${results.length} relevant document(s)`);
  });

program
  .command('list')
  .description('List all markdown files')
  .argument('[directories...]', 'Directories to search')
  .option('-c, --count', 'Show only count', false)
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .option('--doc <name>', 'List only from named documentation (prefix match)')
  .action((directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const dirs = resolveDirectories(directories, config, options.doc);

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || []),
    ];

    const files = findMarkdownFilesFromDirs(dirs, {
      exclude: excludePatterns,
      extensions: config.extensions,
    });

    if (options.count) {
      console.log(files.length);
    } else {
      files.forEach((f) => console.log(f.relativePath));
    }
  });

program
  .command('show')
  .description('Show full content of a markdown file')
  .argument('<file>', 'File path')
  .option('-f, --frontmatter-only', 'Show only frontmatter', false)
  .option('-b, --body-only', 'Show only body content', false)
  .action((file, options) => {
    const parsed = parseMarkdownFile(file);

    if (options.frontmatterOnly) {
      console.log(JSON.stringify(parsed.frontmatter, null, 2));
    } else if (options.bodyOnly) {
      console.log(parsed.body);
    } else {
      console.log(parsed.fullContent);
    }
  });

program
  .command('outline')
  .description('Show document structure (headings only)')
  .argument('[paths...]', 'File or directory paths')
  .option('-d, --depth <number>', 'Maximum heading depth', '6')
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .option(
    '--doc <name>',
    'Show outline only from named documentation (prefix match)'
  )
  .action((paths, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const maxDepth = parseInt(options.depth);
    // When paths provided, use them directly; otherwise use config entries
    const dirs = paths.length
      ? null
      : resolveDirectories([], config, options.doc);
    const targetPaths = paths.length ? paths : dirs.map((d) => d.resolvedPath);

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || []),
    ];

    for (const targetPath of targetPaths) {
      try {
        const stat = statSync(targetPath);

        if (stat.isFile()) {
          const parsed = parseMarkdownFile(targetPath);
          const lines = parsed.body.split('\n');
          const headings = extractHeadings(lines).filter(
            (h) => h.level <= maxDepth
          );

          if (options.output === 'json') {
            console.log(JSON.stringify({ file: targetPath, headings }));
          } else {
            console.log(`📄 ${targetPath}`);
            headings.forEach((h) => {
              console.log(
                `${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`
              );
            });
          }
        } else {
          const files = findMarkdownFiles(targetPath, targetPath, {
            exclude: excludePatterns,
            extensions: config.extensions,
          });
          files.forEach((file) => {
            const parsed = parseMarkdownFile(file.path);
            const lines = parsed.body.split('\n');
            const headings = extractHeadings(lines).filter(
              (h) => h.level <= maxDepth
            );
            // Format path based on config
            const displayPath = formatOutputPath(
              file.path,
              file.relativePath,
              config
            );

            if (options.output === 'json') {
              console.log(JSON.stringify({ file: displayPath, headings }));
            } else {
              console.log(`\n📄 ${displayPath}`);
              headings.forEach((h) => {
                console.log(
                  `${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`
                );
              });
            }
          });
        }
      } catch (err) {
        console.error(`Error reading path '${targetPath}': ${err.message}`);
      }
    }
  });

program
  .command('section')
  .description('Extract a specific section by heading')
  .argument('<file>', 'Markdown file path')
  .argument(
    '<heading>',
    'Heading text or path (e.g., "Installation" or "Setup > Prerequisites")'
  )
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .action((file, heading, options) => {
    const parsed = parseMarkdownFile(file);
    const lines = parsed.body.split('\n');
    const headings = extractHeadings(lines);
    const sectionContent = extractSection(lines, headings, heading);

    if (!sectionContent) {
      console.error(`Section "${heading}" not found in ${file}`);
      process.exit(1);
    }

    if (options.output === 'json') {
      console.log(JSON.stringify({ file, heading, content: sectionContent }));
    } else {
      console.log(sectionContent);
    }
  });

program
  .command('init')
  .description('Create a configuration file in the current directory')
  .option('-f, --force', 'Overwrite existing config file', false)
  .option('-d, --directories <dirs...>', 'Default directories to search')
  .option('--no-interactive', 'Skip interactive wizard')
  .action(async (options) => {
    // Determine if we should run interactive mode
    // Interactive if: TTY available AND not explicitly disabled
    const shouldBeInteractive =
      process.stdout.isTTY && options.interactive !== false;

    if (shouldBeInteractive) {
      await runInteractiveInit({
        force: options.force,
        directories: options.directories,
      });
      return;
    }

    // Non-interactive mode (original behavior)
    const configPath = join(process.cwd(), '.ccmdsrc');

    if (existsSync(configPath) && !options.force) {
      console.error(`Config file already exists: ${configPath}`);
      console.error('Use --force to overwrite');
      process.exit(1);
    }

    const configContent = generateDefaultConfig({
      directories: options.directories,
    });

    writeFileSync(configPath, configContent, 'utf-8');
    console.log(`Created config file: ${configPath}`);
  });

program
  .command('config')
  .description('Show current configuration')
  .option('-p, --path', 'Show only config file path', false)
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .action((options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);

    if (options.path) {
      if (config._source === 'defaults') {
        console.log('No config file found (using defaults)');
      } else {
        console.log(config._source);
      }
      return;
    }

    // Clean config for display (remove internal keys)
    const displayConfig = { ...config };
    delete displayConfig._source;
    delete displayConfig._configDir;

    if (options.output === 'json') {
      console.log(JSON.stringify(displayConfig, null, 2));
    } else {
      console.log('Current Configuration:');
      console.log('─'.repeat(40));

      if (config._source && config._source !== 'defaults') {
        console.log(`Source: ${config._source}`);
      } else {
        console.log('Source: defaults (no config file)');
      }

      console.log(
        '\nDirectories:',
        displayConfig.documentDirectories.join(', ')
      );
      console.log('Output mode:', displayConfig.outputMode);
      console.log('Path format:', displayConfig.pathFormat || 'cwd');
      console.log('Result limit:', displayConfig.limit);
      console.log('Extensions:', displayConfig.extensions.join(', '));

      if (displayConfig.exclude.length > 0) {
        console.log('Exclude patterns:');
        displayConfig.exclude.forEach((p) => console.log(`  - ${p}`));
      }

      if (Object.keys(displayConfig.aliases).length > 0) {
        console.log('\nAliases:');
        Object.entries(displayConfig.aliases).forEach(([name, cmd]) => {
          console.log(`  ${name}: ${cmd}`);
        });
      }

      console.log('\nFuzzy search:');
      console.log(`  Threshold: ${displayConfig.fuzzy.threshold}`);

      console.log('\nPreview:');
      console.log(`  Max lines: ${displayConfig.preview.maxLines}`);
      console.log(
        `  Fallback lengths: ${displayConfig.preview.topResults}/${displayConfig.preview.midResults}/${displayConfig.preview.otherResults} chars`
      );

      console.log('\nCache:');
      console.log(`  Enabled: ${displayConfig.cache?.enabled || false}`);
      console.log(`  TTL: ${displayConfig.cache?.ttl || 300} seconds`);
      console.log(`  Max entries: ${displayConfig.cache?.maxEntries || 50}`);
    }
  });

program
  .command('cache')
  .description('Manage search result cache')
  .argument('[action]', 'Action: clear, stats (default: stats)')
  .action((action = 'stats') => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);

    if (action === 'clear') {
      const count = clearCache(config);
      console.log(`Cleared ${count} cached entries`);
    } else if (action === 'stats') {
      const stats = getCacheStats(config);
      console.log('Cache Statistics:');
      console.log('─'.repeat(40));
      console.log(`Enabled: ${stats.enabled}`);
      console.log(`Cache file: ${stats.path}`);
      console.log(`File exists: ${stats.exists}`);
      console.log(`Total entries: ${stats.totalEntries}`);
      console.log(`Valid entries: ${stats.validEntries}`);
      console.log(`Expired entries: ${stats.expiredEntries}`);
      if (Object.keys(stats.commands).length > 0) {
        console.log('\nEntries by command:');
        Object.entries(stats.commands).forEach(([cmd, count]) => {
          console.log(`  ${cmd}: ${count}`);
        });
      }
    } else {
      console.error(`Unknown cache action: ${action}`);
      console.error('Available actions: clear, stats');
      process.exit(1);
    }
  });

program
  .command('index')
  .description('Manage search index')
  .argument('[action]', 'Action: clear, stats, rebuild (default: stats)')
  .option('--doc <name>', 'Target specific documentation (prefix match)')
  .action(async (action = 'stats', options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);

    if (action === 'clear') {
      const cleared = clearIndexCache(config);
      if (cleared) {
        console.log('Search index cleared');
      } else {
        console.log('No index files found');
      }
    } else if (action === 'rebuild') {
      const dirs = resolveDirectories(null, config, options.doc);
      const excludePatterns = config.exclude || [];

      const files = findMarkdownFilesFromDirs(dirs, {
        exclude: excludePatterns,
        extensions: config.extensions,
      });

      console.log(`Rebuilding index for ${files.length} files...`);
      await buildOrLoadIndex(files, config, true);
      console.log('Index rebuilt successfully');
    } else if (action === 'stats') {
      const stats = getIndexStats(config);
      console.log('Index Statistics:');
      console.log('─'.repeat(40));
      console.log(`Enabled: ${stats.enabled}`);
      console.log(`Index file: ${stats.indexPath}`);
      console.log(`Meta file: ${stats.metaPath}`);
      console.log(`Index exists: ${stats.indexExists}`);
      console.log(`Metadata exists: ${stats.metaExists}`);
      if (stats.fileCount) {
        console.log(`Files indexed: ${stats.fileCount}`);
      }
      if (stats.age !== null) {
        console.log(`Index age: ${stats.age} seconds`);
      }
    } else {
      console.error(`Unknown index action: ${action}`);
      console.error('Available actions: clear, stats, rebuild');
      process.exit(1);
    }
  });

program
  .command('docs')
  .description('List all configured documentation directories')
  .option('-o, --output <mode>', 'Output mode: text, json', 'text')
  .action((options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const entries = resolveDirectories(null, config);

    if (options.output === 'json') {
      console.log(
        JSON.stringify(
          entries.map((e) => ({
            name: e.name,
            path: e.path,
            description: e.description,
          }))
        )
      );
    } else {
      if (entries.length === 0) {
        console.log('No documentation directories configured.');
        console.log(
          'Add directories to your .ccmdsrc file or run: ccmds init -d ./docs'
        );
        return;
      }
      console.log('Configured Documentations:\n');
      entries.forEach((e) => {
        console.log(`  ${e.name}`);
        console.log(`    Path: ${e.path}`);
        if (e.description) {
          console.log(`    ${e.description}`);
        }
        console.log();
      });
    }
  });

program
  .command('update')
  .description('Update cc-md-search-cli to the latest version')
  .option('--check', 'Only check if update is available (no install)')
  .action(async (options) => {
    const { current, latest, updateAvailable } = await checkForUpdate();

    if (latest === null) {
      console.log(
        'Unable to check for updates. Check your internet connection.'
      );
      return;
    }

    if (!updateAvailable) {
      console.log(`You're on the latest version (${current}).`);
      return;
    }

    console.log(`Update available: ${current} → ${latest}`);

    if (options.check) {
      console.log('\nTo update, run: ccmds update');
      return;
    }

    // Detect package manager and run update
    const { spawnSync } = await import('child_process');

    // Try bun first, fall back to npm
    const bunResult = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
    const useBun = bunResult.status === 0;

    const cmd = useBun ? 'bun' : 'npm';
    const args = useBun
      ? ['update', '-g', 'cc-md-search-cli']
      : ['update', '-g', 'cc-md-search-cli'];

    console.log(`\nUpdating via ${cmd}...`);
    const result = spawnSync(cmd, args, { stdio: 'inherit' });

    if (result.status === 0) {
      console.log(`\nSuccessfully updated to ${latest}!`);
    } else {
      console.log(
        `\nUpdate failed. Try manually: ${cmd} update -g cc-md-search-cli`
      );
    }
  });

// Only parse if running directly (not imported for testing)
// Support both Bun (import.meta.main) and Node.js (compare URLs)
const isMainModule = () => {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};

if (isMainModule()) {
  // Handle version flag with async update check before parsing
  (async () => {
    try {
      await handleVersionFlag();
    } catch (err) {
      console.error('Warning: version check failed:', err);
    } finally {
      program.parse();
    }
  })();
}

// ============================================================================
// Re-export everything for backward compatibility with tests
// ============================================================================

export * from './index.js';

// Also export program for testing
export { program };

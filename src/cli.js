#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync, readdirSync, statSync, realpathSync, existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import Fuse from 'fuse.js';

const program = new Command();

// ============================================================================
// Configuration System
// ============================================================================

const CONFIG_FILE_NAMES = [
  '.ccmdsrc',
  '.ccmdsrc.json',
  'ccmds.config.json'
];

const DEFAULT_CONFIG = {
  defaultDirectories: ['.'],
  exclude: [],
  outputMode: 'json',
  limit: 10,
  fuzzy: {
    threshold: 0.4,
    weights: {
      title: 2,
      description: 1.5,
      tags: 1.5,
      body: 1
    }
  },
  preview: {
    topResults: 600,
    midResults: 300,
    otherResults: 150
  },
  frontmatterFields: ['title', 'description', 'tags', 'category', 'summary', 'keywords'],
  extensions: ['.md', '.markdown'],
  aliases: {},
  cache: {
    enabled: false,
    ttl: 300,
    maxEntries: 50
  }
};

/**
 * Find config file by walking up directory tree
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Path to config file or null
 */
function findConfigFile(startDir = process.cwd()) {
  let currentDir = startDir;

  // Walk up directory tree
  while (currentDir !== dirname(currentDir)) {
    for (const configName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, configName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }

  // Check home directory as fallback
  const homeDir = homedir();
  for (const configName of CONFIG_FILE_NAMES) {
    const configPath = join(homeDir, configName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Load and parse configuration file
 * @param {string} configPath - Path to config file
 * @returns {object} - Parsed configuration
 */
function loadConfigFile(configPath) {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // Store the config file directory for resolving relative paths
    config._configDir = dirname(configPath);
    config._configPath = configPath;

    return config;
  } catch (err) {
    console.error(`Error loading config file '${configPath}': ${err.message}`);
    return null;
  }
}

/**
 * Load configuration with hierarchical lookup
 * @param {object} options - CLI options that may override config
 * @returns {object} - Merged configuration
 */
function loadConfig(options = {}) {
  let config;

  // If --no-config flag is set, return defaults
  if (options.noConfig) {
    config = { ...DEFAULT_CONFIG, _source: 'defaults' };
  } else if (options.config) {
    // If explicit config path provided
    const fileConfig = loadConfigFile(options.config);
    if (fileConfig) {
      config = mergeConfig(DEFAULT_CONFIG, fileConfig, options);
    } else {
      console.error(`Config file not found: ${options.config}`);
      process.exit(1);
    }
  } else {
    // Hierarchical lookup
    const configPath = findConfigFile();
    if (configPath) {
      const fileConfig = loadConfigFile(configPath);
      if (fileConfig) {
        config = mergeConfig(DEFAULT_CONFIG, fileConfig, options);
      } else {
        config = { ...DEFAULT_CONFIG, _source: 'defaults' };
      }
    } else {
      config = { ...DEFAULT_CONFIG, _source: 'defaults' };
    }
  }

  // Handle --no-cache flag
  if (options.noCache) {
    config.cache = { ...config.cache, enabled: false };
  }

  return config;
}

/**
 * Deep merge configuration objects
 * @param {object} defaults - Default configuration
 * @param {object} fileConfig - Configuration from file
 * @param {object} cliOptions - CLI options (highest priority)
 * @returns {object} - Merged configuration
 */
function mergeConfig(defaults, fileConfig, cliOptions = {}) {
  const merged = { ...defaults };

  // Merge file config
  if (fileConfig) {
    for (const key of Object.keys(fileConfig)) {
      if (key.startsWith('_')) continue; // Skip internal keys

      if (typeof fileConfig[key] === 'object' && !Array.isArray(fileConfig[key]) && fileConfig[key] !== null) {
        merged[key] = { ...defaults[key], ...fileConfig[key] };
      } else {
        merged[key] = fileConfig[key];
      }
    }
    merged._source = fileConfig._configPath || 'file';
    merged._configDir = fileConfig._configDir;
  }

  // CLI options override (map CLI option names to config keys)
  if (cliOptions.output) merged.outputMode = cliOptions.output;
  if (cliOptions.limit) merged.limit = parseInt(cliOptions.limit);

  return merged;
}

/**
 * Resolve directories from config (handles relative paths)
 * @param {string[]} directories - Directory paths from CLI or config
 * @param {object} config - Configuration object
 * @returns {string[]} - Resolved directory paths
 */
function resolveDirectories(directories, config) {
  // If directories provided via CLI, use them directly
  if (directories && directories.length > 0) {
    return directories;
  }

  // Use config defaults, resolving relative paths from config file location
  const configDir = config._configDir || process.cwd();
  return config.defaultDirectories.map(dir => {
    if (dir.startsWith('/') || dir.startsWith('~')) {
      return dir.replace(/^~/, homedir());
    }
    return join(configDir, dir);
  });
}

/**
 * Check if a path matches any exclude pattern
 * @param {string} filePath - Path to check
 * @param {string[]} excludePatterns - Array of glob-like patterns
 * @returns {boolean} - True if path should be excluded
 */
function shouldExclude(filePath, excludePatterns) {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false;
  }

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of excludePatterns) {
    if (matchGlobPattern(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a path against a glob pattern
 * @param {string} path - Normalized path to check
 * @param {string} pattern - Glob pattern
 * @returns {boolean} - True if path matches pattern
 */
function matchGlobPattern(path, pattern) {
  // Normalize pattern
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Split pattern into segments
  const patternParts = normalizedPattern.split('/');
  const pathParts = path.split('/');

  return matchParts(pathParts, patternParts, 0, 0);
}

/**
 * Recursively match path parts against pattern parts
 */
function matchParts(pathParts, patternParts, pathIdx, patternIdx) {
  // If we've matched all pattern parts, check if path is also exhausted
  if (patternIdx >= patternParts.length) {
    return pathIdx >= pathParts.length;
  }

  const patternPart = patternParts[patternIdx];

  // Handle ** (globstar) - matches zero or more directories
  if (patternPart === '**') {
    // ** at the end matches everything
    if (patternIdx === patternParts.length - 1) {
      return true;
    }

    // Try matching ** with zero or more path segments
    for (let i = pathIdx; i <= pathParts.length; i++) {
      if (matchParts(pathParts, patternParts, i, patternIdx + 1)) {
        return true;
      }
    }
    return false;
  }

  // If path is exhausted but pattern isn't
  if (pathIdx >= pathParts.length) {
    return false;
  }

  const pathPart = pathParts[pathIdx];

  // Match single segment with possible wildcards
  if (matchSegment(pathPart, patternPart)) {
    return matchParts(pathParts, patternParts, pathIdx + 1, patternIdx + 1);
  }

  return false;
}

/**
 * Match a single path segment against a pattern segment (handles * and ?)
 */
function matchSegment(segment, pattern) {
  // Convert pattern to regex
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*') {
      regexStr += '.*';
    } else if (char === '?') {
      regexStr += '.';
    } else if (/[.+^${}()|[\]\\]/.test(char)) {
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }
  }
  regexStr += '$';

  return new RegExp(regexStr).test(segment);
}

/**
 * Generate default configuration content
 * @param {object} options - Options for config generation
 * @returns {string} - JSON configuration content
 */
function generateDefaultConfig(options = {}) {
  const config = {
    defaultDirectories: options.directories || ['./docs'],
    exclude: [
      '**/node_modules/**',
      '**/.*/**'
    ],
    outputMode: 'json',
    limit: 10,
    fuzzy: {
      threshold: 0.4
    },
    extensions: ['.md', '.markdown'],
    aliases: {}
  };

  return JSON.stringify(config);
}

// ============================================================================
// Cache System
// ============================================================================

const CACHE_FILE = '.ccmds-cache.json';
const CACHE_VERSION = 1;

/**
 * Generate a cache key from command and options
 * @param {string} command - Command name
 * @param {object} params - Parameters to include in key
 * @returns {string} - Cache key hash
 */
function generateCacheKey(command, params) {
  const keyData = JSON.stringify({ command, ...params });
  return createHash('md5').update(keyData).digest('hex').substring(0, 12);
}

/**
 * Get cache file path (in project root or config directory)
 * @param {object} config - Configuration object
 * @returns {string} - Cache file path
 */
function getCacheFilePath(config) {
  const baseDir = config._configDir || process.cwd();
  return join(baseDir, CACHE_FILE);
}

/**
 * Read cache from file
 * @param {string} cachePath - Path to cache file
 * @returns {object} - Cache data or empty cache structure
 */
function readCache(cachePath) {
  try {
    if (existsSync(cachePath)) {
      const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
      if (data.version === CACHE_VERSION) {
        return data;
      }
    }
  } catch (err) {
    // Ignore corrupted cache
  }
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Write cache to file
 * @param {string} cachePath - Path to cache file
 * @param {object} cache - Cache data
 */
function writeCache(cachePath, cache) {
  try {
    writeFileSync(cachePath, JSON.stringify(cache));
  } catch (err) {
    // Ignore write errors
  }
}

/**
 * Get cached result if valid
 * @param {object} config - Configuration object
 * @param {string} cacheKey - Cache key
 * @returns {object|null} - Cached results or null
 */
function getCachedResult(config, cacheKey) {
  if (!config.cache?.enabled) return null;

  const cachePath = getCacheFilePath(config);
  const cache = readCache(cachePath);
  const entry = cache.entries[cacheKey];

  if (!entry) return null;

  // Check TTL
  const ttl = config.cache.ttl || 300;
  const age = (Date.now() - entry.created) / 1000;
  if (age > ttl) {
    // Expired - remove entry
    delete cache.entries[cacheKey];
    writeCache(cachePath, cache);
    return null;
  }

  return entry.results;
}

/**
 * Store result in cache
 * @param {object} config - Configuration object
 * @param {string} cacheKey - Cache key
 * @param {string} command - Command name
 * @param {any} results - Results to cache
 */
function setCachedResult(config, cacheKey, command, results) {
  if (!config.cache?.enabled) return;

  const cachePath = getCacheFilePath(config);
  const cache = readCache(cachePath);

  // Add new entry
  cache.entries[cacheKey] = {
    created: Date.now(),
    command,
    results
  };

  // Trim old entries if over limit
  const maxEntries = config.cache.maxEntries || 50;
  const entries = Object.entries(cache.entries);
  if (entries.length > maxEntries) {
    // Sort by created time, remove oldest
    entries.sort((a, b) => a[1].created - b[1].created);
    const toRemove = entries.slice(0, entries.length - maxEntries);
    toRemove.forEach(([key]) => delete cache.entries[key]);
  }

  writeCache(cachePath, cache);
}

/**
 * Clear all cache entries
 * @param {object} config - Configuration object
 * @returns {number} - Number of entries cleared
 */
function clearCache(config) {
  const cachePath = getCacheFilePath(config);
  if (existsSync(cachePath)) {
    const cache = readCache(cachePath);
    const count = Object.keys(cache.entries).length;
    unlinkSync(cachePath);
    return count;
  }
  return 0;
}

/**
 * Get cache statistics
 * @param {object} config - Configuration object
 * @returns {object} - Cache stats
 */
function getCacheStats(config) {
  const cachePath = getCacheFilePath(config);
  const cache = readCache(cachePath);
  const entries = Object.values(cache.entries);
  const now = Date.now();
  const ttl = (config.cache?.ttl || 300) * 1000;

  return {
    enabled: config.cache?.enabled || false,
    path: cachePath,
    exists: existsSync(cachePath),
    totalEntries: entries.length,
    validEntries: entries.filter(e => (now - e.created) < ttl).length,
    expiredEntries: entries.filter(e => (now - e.created) >= ttl).length,
    commands: entries.reduce((acc, e) => {
      acc[e.command] = (acc[e.command] || 0) + 1;
      return acc;
    }, {})
  };
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Recursively find all markdown files
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @param {object} options - Options (exclude patterns, extensions)
 * @param {boolean} isRecursive - Internal flag for recursive calls
 * @returns {Array} - Array of file objects
 */
function findMarkdownFiles(dir, baseDir = dir, options = {}, isRecursive = false) {
  const extensions = options.extensions || ['.md', '.markdown'];
  const exclude = options.exclude || [];
  let files = [];

  let items;
  try {
    items = readdirSync(dir);
  } catch (err) {
    // For top-level directory, throw error so caller can handle it
    // For nested directories (recursive calls), silently skip
    if (!isRecursive) {
      throw err;
    }
    return files;
  }

  for (const item of items) {
    const fullPath = join(dir, item);
    const relativePath = relative(baseDir, fullPath);

    // Check exclusion patterns
    if (shouldExclude(relativePath, exclude)) {
      continue;
    }

    let stat;
    try {
      stat = statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory()) {
      files = files.concat(findMarkdownFiles(fullPath, baseDir, options, true));
    } else {
      const hasValidExtension = extensions.some(ext => item.endsWith(ext));
      if (hasValidExtension) {
        files.push({
          path: fullPath,
          relativePath
        });
      }
    }
  }

  return files;
}

/**
 * Find markdown files from multiple directories
 * @param {string[]} directories - Directories to search
 * @param {object} options - Options (exclude patterns, extensions)
 * @returns {Array} - Array of file objects
 */
function findMarkdownFilesFromDirs(directories, options = {}) {
  let allFiles = [];
  for (const dir of directories) {
    try {
      const files = findMarkdownFiles(dir, dir, options);
      // Prefix relative paths with directory name for multi-dir scenarios
      const prefixedFiles = directories.length > 1
        ? files.map(f => ({
            path: f.path,
            relativePath: join(basename(dir), f.relativePath)
          }))
        : files;
      allFiles = allFiles.concat(prefixedFiles);
    } catch (err) {
      console.error(`Error reading directory '${dir}': ${err.message}`);
    }
  }
  return allFiles;
}

// Parse markdown file with frontmatter
function parseMarkdownFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  return {
    filePath,
    frontmatter,
    body,
    fullContent: content
  };
}

// Extract all headings from markdown
function extractHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i
      });
    }
  }
  return headings;
}

// Find nearest parent heading for a line
function findParentHeading(headings, lineIndex) {
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex) {
      return headings[i];
    }
  }
  return null;
}

// Build heading path (e.g., "## Setup > ### Prerequisites")
function buildHeadingPath(headings, lineIndex) {
  const path = [];
  let currentLevel = 7;
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex && headings[i].level < currentLevel) {
      path.unshift(`${'#'.repeat(headings[i].level)} ${headings[i].text}`);
      currentLevel = headings[i].level;
    }
  }
  return path.join(' > ');
}

// Extract smart context (paragraph boundaries, preserve code blocks)
function extractSmartContext(lines, matchIndex) {
  let start = matchIndex;
  let end = matchIndex;

  // Check if we're inside a code block
  let inCodeBlock = false;
  let codeBlockStart = -1;
  for (let i = 0; i <= matchIndex; i++) {
    if (lines[i].startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) codeBlockStart = i;
    }
  }

  if (inCodeBlock) {
    // Find code block boundaries
    start = codeBlockStart;
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('```')) {
        end = i;
        break;
      }
    }
  } else {
    // Find paragraph boundaries (blank lines)
    for (let i = matchIndex - 1; i >= 0; i--) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        start = i + 1;
        break;
      }
      start = i;
    }
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        end = i - 1;
        break;
      }
      end = i;
    }
  }

  return { start, end };
}

// Filter frontmatter to useful fields
const USEFUL_FRONTMATTER = ['title', 'description', 'tags', 'category', 'summary', 'keywords'];

function filterFrontmatter(frontmatter, config = null) {
  const fields = config?.frontmatterFields || USEFUL_FRONTMATTER;
  const filtered = {};
  for (const key of fields) {
    if (frontmatter[key] !== undefined) {
      filtered[key] = frontmatter[key];
    }
  }
  return filtered;
}

// Get section content by heading
function extractSection(lines, headings, headingText) {
  // Support heading path like "Installation > Prerequisites"
  const pathParts = headingText.split('>').map(p => p.trim().replace(/^#+\s*/, ''));
  const targetHeading = pathParts[pathParts.length - 1].toLowerCase();

  let startIdx = -1;
  let startLevel = 0;

  for (const h of headings) {
    if (h.text.toLowerCase().includes(targetHeading)) {
      startIdx = h.line;
      startLevel = h.level;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find end (next heading of same or higher level)
  let endIdx = lines.length;
  for (const h of headings) {
    if (h.line > startIdx && h.level <= startLevel) {
      endIdx = h.line;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n');
}

// Grep-style search
function grepSearch(files, query, options) {
  const config = options.config || DEFAULT_CONFIG;
  const results = [];

  let regex;
  try {
    regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
  } catch (err) {
    console.error(`Invalid regex pattern '${query}': ${err.message}`);
    return results;
  }

  for (const file of files) {
    const parsed = parseMarkdownFile(file.path);
    const lines = parsed.body.split('\n');
    const headings = extractHeadings(lines);
    const matches = [];
    const processedRanges = []; // For deduplication

    lines.forEach((line, index) => {
      if (regex.test(line)) {
        const { start, end } = options.raw
          ? { start: Math.max(0, index - options.context), end: Math.min(lines.length - 1, index + options.context) }
          : extractSmartContext(lines, index);

        // Skip if this range overlaps with already processed
        const overlaps = processedRanges.some(r =>
          (start >= r.start && start <= r.end) || (end >= r.start && end <= r.end)
        );

        if (!overlaps) {
          processedRanges.push({ start, end });
          matches.push({
            lineNumber: index + 1,
            line: line.trim(),
            headingPath: options.raw ? null : buildHeadingPath(headings, index),
            context: lines.slice(start, end + 1).join('\n'),
            range: { start: start + 1, end: end + 1 }
          });
        }
      }
    });

    if (matches.length > 0) {
      results.push({
        file: file.relativePath,
        matches,
        frontmatter: options.raw ? parsed.frontmatter : filterFrontmatter(parsed.frontmatter, config)
      });
    }
  }

  return results;
}

// Fuzzy search for finding relevant documents
function fuzzySearch(files, query, options) {
  const config = options.config || DEFAULT_CONFIG;
  const fuzzyConfig = config.fuzzy || DEFAULT_CONFIG.fuzzy;
  const previewConfig = config.preview || DEFAULT_CONFIG.preview;

  const documents = files.map(file => {
    const parsed = parseMarkdownFile(file.path);
    return {
      file: file.relativePath,
      title: parsed.frontmatter.title || file.relativePath,
      body: parsed.body,
      frontmatter: parsed.frontmatter,
      tags: parsed.frontmatter.tags || [],
      description: parsed.frontmatter.description || ''
    };
  });

  const weights = fuzzyConfig.weights || DEFAULT_CONFIG.fuzzy.weights;
  const fuse = new Fuse(documents, {
    keys: [
      { name: 'title', weight: weights.title || 2 },
      { name: 'description', weight: weights.description || 1.5 },
      { name: 'body', weight: weights.body || 1 },
      { name: 'tags', weight: weights.tags || 1.5 }
    ],
    threshold: fuzzyConfig.threshold || 0.4,
    includeScore: true,
    minMatchCharLength: 2,
    useExtendedSearch: true
  });

  const results = fuse.search(query);

  return results.slice(0, options.limit).map((result, index) => {
    // Adaptive preview length based on rank (configurable)
    const previewLength = options.raw ? 200 :
      index < 3 ? (previewConfig.topResults || 600) :
      index < 7 ? (previewConfig.midResults || 300) : (previewConfig.otherResults || 150);

    // Prefer description over body truncation
    let preview = result.item.description || '';
    if (preview.length < previewLength) {
      preview = result.item.body.substring(0, previewLength);
    }
    if (preview.length >= previewLength) {
      preview = preview.substring(0, previewLength).replace(/\s+\S*$/, '') + '...';
    }

    return {
      file: result.item.file,
      score: result.score,
      title: result.item.title,
      frontmatter: options.raw ? result.item.frontmatter : filterFrontmatter(result.item.frontmatter, config),
      preview
    };
  });
}

// Format output
function formatOutput(results, mode) {
  if (mode === 'json') {
    // Compact JSON optimized for AI consumption
    const compactResults = results.map(r => {
      const out = { file: r.file };

      // Round score to 3 decimal places if present
      if (r.score !== undefined) {
        out.score = Math.round(r.score * 1000) / 1000;
      }

      // Include title only if not in frontmatter (avoid duplication)
      if (r.title && (!r.frontmatter || r.frontmatter.title !== r.title)) {
        out.title = r.title;
      }

      // Include frontmatter if present and non-empty
      if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
        out.frontmatter = r.frontmatter;
      }

      // Include matches for grep results
      if (r.matches) {
        out.matches = r.matches.map(m => ({
          line: m.lineNumber,
          heading: m.headingPath || undefined,
          text: m.line,
          context: m.context
        })).map(m => {
          // Remove undefined values
          Object.keys(m).forEach(k => m[k] === undefined && delete m[k]);
          return m;
        });
      }

      // Include preview for find results
      if (r.preview) {
        out.preview = r.preview.trim();
      }

      return out;
    });

    return JSON.stringify(compactResults);
  }

  if (mode === 'files') {
    return results.map(r => r.file).join('\n');
  }

  if (mode === 'compact') {
    return results.map(r => {
      let output = `\n📄 ${r.file}`;
      if (r.score !== undefined) {
        output += ` (relevance: ${(1 - r.score).toFixed(2)})`;
      }
      if (r.matches) {
        output += `\n   ${r.matches.length} match(es)`;
        r.matches.slice(0, 3).forEach(m => {
          if (m.headingPath) {
            output += `\n   ┌ ${m.headingPath}`;
          }
          output += `\n   │ Line ${m.lineNumber}: ${m.line.substring(0, 100)}${m.line.length > 100 ? '...' : ''}`;
        });
      } else if (r.preview) {
        output += `\n   ${r.preview}`;
      }
      return output;
    }).join('\n');
  }

  // Default: detailed
  return results.map(r => {
    let output = `\n${'─'.repeat(60)}\n📄 ${r.file}\n${'─'.repeat(60)}`;

    if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
      output += '\n' + Object.entries(r.frontmatter)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
    }

    if (r.matches) {
      r.matches.forEach(m => {
        if (m.headingPath) {
          output += `\n\n◆ ${m.headingPath} (lines ${m.range.start}-${m.range.end})`;
        }
        output += `\n${m.context}`;
      });
    } else if (r.preview) {
      output += `\n\n${r.preview}`;
    }

    return output;
  }).join('\n');
}

// ============================================================================
// Main CLI
// ============================================================================

program
  .name('ccmds')
  .description('Claude Code Markdown Search - CLI for efficient document querying')
  .version('1.0.3')
  .option('--config <path>', 'Path to config file')
  .option('--no-config', 'Ignore config file')
  .option('--no-cache', 'Skip cache for this command');

program
  .command('grep')
  .description('Search for exact text patterns (regex supported)')
  .argument('<query>', 'Search query (regex pattern)')
  .argument('[directories...]', 'Directories to search')
  .option('-c, --context <lines>', 'Lines of context around matches', '2')
  .option('-s, --case-sensitive', 'Case sensitive search', false)
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json')
  .option('-r, --raw', 'Disable smart context (use line-based context)', false)
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .action((query, directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const dirs = resolveDirectories(directories, config);
    const outputMode = options.output || config.outputMode;

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || [])
    ];

    // Check cache
    const cacheKey = generateCacheKey('grep', {
      query,
      dirs: dirs.sort(),
      caseSensitive: options.caseSensitive,
      exclude: excludePatterns.sort()
    });
    let results = getCachedResult(config, cacheKey);

    if (!results) {
      const files = findMarkdownFilesFromDirs(dirs, {
        exclude: excludePatterns,
        extensions: config.extensions
      });

      results = grepSearch(files, query, {
        context: parseInt(options.context),
        caseSensitive: options.caseSensitive,
        raw: options.raw,
        config
      });

      setCachedResult(config, cacheKey, 'grep', results);
    }

    console.log(formatOutput(results, outputMode));
    console.log(`\n✓ Found ${results.length} file(s) with matches`);
  });

program
  .command('find')
  .description('Fuzzy search for relevant documents')
  .argument('<query>', 'Search query')
  .argument('[directories...]', 'Directories to search')
  .option('-l, --limit <number>', 'Maximum results to return')
  .option('-o, --output <mode>', 'Output mode: detailed, compact, files, json')
  .option('-r, --raw', 'Disable adaptive previews and frontmatter filtering', false)
  .option('-e, --exclude <patterns...>', 'Exclude patterns (glob syntax)')
  .action((query, directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const dirs = resolveDirectories(directories, config);
    const outputMode = options.output || config.outputMode;
    const limit = options.limit ? parseInt(options.limit) : config.limit;

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || [])
    ];

    // Check cache
    const cacheKey = generateCacheKey('find', {
      query,
      dirs: dirs.sort(),
      limit,
      exclude: excludePatterns.sort()
    });
    let results = getCachedResult(config, cacheKey);

    if (!results) {
      const files = findMarkdownFilesFromDirs(dirs, {
        exclude: excludePatterns,
        extensions: config.extensions
      });

      results = fuzzySearch(files, query, {
        limit,
        raw: options.raw,
        config
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
  .action((directories, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const dirs = resolveDirectories(directories, config);

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || [])
    ];

    const files = findMarkdownFilesFromDirs(dirs, {
      exclude: excludePatterns,
      extensions: config.extensions
    });

    if (options.count) {
      console.log(files.length);
    } else {
      files.forEach(f => console.log(f.relativePath));
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
  .action((paths, options) => {
    const globalOpts = program.opts();
    const config = loadConfig(globalOpts);
    const maxDepth = parseInt(options.depth);
    const targetPaths = paths.length ? paths : resolveDirectories([], config);

    // Merge exclude patterns from CLI and config
    const excludePatterns = [
      ...(config.exclude || []),
      ...(options.exclude || [])
    ];

    for (const targetPath of targetPaths) {
      try {
        const stat = statSync(targetPath);

        if (stat.isFile()) {
          const parsed = parseMarkdownFile(targetPath);
          const lines = parsed.body.split('\n');
          const headings = extractHeadings(lines).filter(h => h.level <= maxDepth);

          if (options.output === 'json') {
            console.log(JSON.stringify({ file: targetPath, headings }));
          } else {
            console.log(`📄 ${targetPath}`);
            headings.forEach(h => {
              console.log(`${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`);
            });
          }
        } else {
          const files = findMarkdownFiles(targetPath, targetPath, {
            exclude: excludePatterns,
            extensions: config.extensions
          });
          files.forEach(file => {
            const parsed = parseMarkdownFile(file.path);
            const lines = parsed.body.split('\n');
            const headings = extractHeadings(lines).filter(h => h.level <= maxDepth);
            // Prefix with directory when multiple paths
            const displayPath = targetPaths.length > 1 ? join(basename(targetPath), file.relativePath) : file.relativePath;

            if (options.output === 'json') {
              console.log(JSON.stringify({ file: displayPath, headings }));
            } else {
              console.log(`\n📄 ${displayPath}`);
              headings.forEach(h => {
                console.log(`${'  '.repeat(h.level - 1)}${'#'.repeat(h.level)} ${h.text}`);
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
  .argument('<heading>', 'Heading text or path (e.g., "Installation" or "Setup > Prerequisites")')
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
  .action((options) => {
    const configPath = join(process.cwd(), '.ccmdsrc');

    if (existsSync(configPath) && !options.force) {
      console.error(`Config file already exists: ${configPath}`);
      console.error('Use --force to overwrite');
      process.exit(1);
    }

    const configContent = generateDefaultConfig({
      directories: options.directories
    });

    writeFileSync(configPath, configContent, 'utf-8');
    console.log(`Created config file: ${configPath}`);
    console.log('\nYou can customize this file to:');
    console.log('  - Set default search directories');
    console.log('  - Add exclude patterns');
    console.log('  - Configure fuzzy search settings');
    console.log('  - Define command aliases');
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

      console.log('\nDirectories:', displayConfig.defaultDirectories.join(', '));
      console.log('Output mode:', displayConfig.outputMode);
      console.log('Result limit:', displayConfig.limit);
      console.log('Extensions:', displayConfig.extensions.join(', '));

      if (displayConfig.exclude.length > 0) {
        console.log('Exclude patterns:');
        displayConfig.exclude.forEach(p => console.log(`  - ${p}`));
      }

      if (Object.keys(displayConfig.aliases).length > 0) {
        console.log('\nAliases:');
        Object.entries(displayConfig.aliases).forEach(([name, cmd]) => {
          console.log(`  ${name}: ${cmd}`);
        });
      }

      console.log('\nFuzzy search:');
      console.log(`  Threshold: ${displayConfig.fuzzy.threshold}`);

      console.log('\nPreview lengths:');
      console.log(`  Top results (1-3): ${displayConfig.preview.topResults} chars`);
      console.log(`  Mid results (4-7): ${displayConfig.preview.midResults} chars`);
      console.log(`  Other results: ${displayConfig.preview.otherResults} chars`);

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
  program.parse();
}

// Export for testing
export {
  // File discovery
  findMarkdownFiles,
  findMarkdownFilesFromDirs,
  shouldExclude,
  matchGlobPattern,
  matchSegment,

  // Parsing
  parseMarkdownFile,
  extractHeadings,
  findParentHeading,
  buildHeadingPath,
  extractSmartContext,
  filterFrontmatter,
  extractSection,

  // Search
  grepSearch,
  fuzzySearch,
  formatOutput,

  // Configuration
  DEFAULT_CONFIG,
  CONFIG_FILE_NAMES,
  findConfigFile,
  loadConfigFile,
  loadConfig,
  mergeConfig,
  resolveDirectories,
  generateDefaultConfig,

  // Cache
  generateCacheKey,
  getCacheFilePath,
  readCache,
  writeCache,
  getCachedResult,
  setCachedResult,
  clearCache,
  getCacheStats,

  // CLI
  program,
  USEFUL_FRONTMATTER
};

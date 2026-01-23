/**
 * Fuse.js index persistence system with incremental delta updates
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import Fuse from 'fuse.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { parseMarkdownFile } from '../parsing/markdown.js';
import { extractFirstHeading } from '../parsing/headings.js';

export const INDEX_VERSION = 3; // Bumped for document cache with delta updates

// In-memory document cache with TTL (10 minutes default)
let documentCache = null;
let documentCacheTimestamp = 0;
const DOCUMENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

/**
 * Get index file path
 * @param {object} config - Configuration object
 * @returns {string} - Index file path
 */
export function getIndexFilePath(config) {
  const baseDir = config._configDir || process.cwd();
  const indexPath = config.index?.path || '.ccmds-fuse-index.json';
  return join(baseDir, indexPath);
}

/**
 * Get index metadata file path
 * @param {object} config - Configuration object
 * @returns {string} - Metadata file path
 */
export function getIndexMetaPath(config) {
  const indexPath = getIndexFilePath(config);
  return indexPath.replace(/\.json$/, '-meta.json');
}

/**
 * Get document cache file path
 * @param {object} config - Configuration object
 * @returns {string} - Document cache file path
 */
export function getDocumentCachePath(config) {
  const baseDir = config._configDir || process.cwd();
  return join(baseDir, '.ccmds-docs-cache.json');
}

/**
 * Compute file hash based on path and mtime
 * @param {string} filePath - File path
 * @returns {string} - Hash string
 */
export function computeFileHash(filePath) {
  try {
    const stat = statSync(filePath);
    return createHash('md5')
      .update(`${filePath}:${stat.mtimeMs}`)
      .digest('hex')
      .substring(0, 12);
  } catch {
    return 'missing';
  }
}

/**
 * Compute hashes for all files
 * @param {Array} files - Array of file objects with path property
 * @returns {object} - Map of file path to hash
 */
export function computeFileHashes(files) {
  const hashes = {};
  for (const file of files) {
    hashes[file.path] = computeFileHash(file.path);
  }
  return hashes;
}

/**
 * Check if the cached index is still fresh
 * @param {string} metaPath - Path to metadata file
 * @param {Array} files - Current files to search
 * @returns {boolean} - True if index is fresh
 */
export function isIndexFresh(metaPath, files) {
  try {
    if (!existsSync(metaPath)) {
      return false;
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

    // Check version
    if (meta.version !== INDEX_VERSION) {
      return false;
    }

    // Check file count
    const currentPaths = new Set(files.map((f) => f.path));
    const cachedPaths = new Set(Object.keys(meta.fileHashes));

    if (currentPaths.size !== cachedPaths.size) {
      return false;
    }

    // Check all files still exist and have same hash
    for (const file of files) {
      const cachedHash = meta.fileHashes[file.path];
      if (!cachedHash) {
        return false;
      }
      const currentHash = computeFileHash(file.path);
      if (currentHash !== cachedHash) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Build Fuse.js keys configuration from weights
 * @param {object} weights - Field weights
 * @returns {Array} - Fuse.js keys array
 */
export function buildFuseKeys(weights) {
  return [
    { name: 'title', weight: weights.title || 2 },
    { name: 'description', weight: weights.description || 1.5 },
    { name: 'body', weight: weights.body || 1 },
    { name: 'tags', weight: weights.tags || 1.5 },
  ];
}

/**
 * Load document cache from disk
 * @param {string} cachePath - Path to cache file
 * @returns {object} - Cache object with version, cachedAt, and documents
 */
function loadDocumentCache(cachePath) {
  try {
    if (!existsSync(cachePath)) {
      return { version: INDEX_VERSION, cachedAt: 0, documents: {} };
    }
    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
    // Check version compatibility
    if (cache.version !== INDEX_VERSION) {
      return { version: INDEX_VERSION, cachedAt: 0, documents: {} };
    }
    return cache;
  } catch {
    return { version: INDEX_VERSION, cachedAt: 0, documents: {} };
  }
}

/**
 * Save document cache to disk
 * @param {string} cachePath - Path to cache file
 * @param {Array} documents - Array of parsed documents
 */
function saveDocumentCache(cachePath, documents) {
  const cache = {
    version: INDEX_VERSION,
    cachedAt: Date.now(),
    documents: {},
  };

  for (const doc of documents) {
    cache.documents[doc._path] = doc;
  }

  try {
    writeFileSync(cachePath, JSON.stringify(cache));
  } catch {
    // Ignore write errors (e.g., read-only filesystem)
  }
}

/**
 * Detect which files have changed since last cache
 * @param {Array} files - Current files to check
 * @param {object} cache - Loaded cache object
 * @returns {object} - Object with changed, added, removed, and unchanged arrays
 */
function detectChanges(files, cache) {
  const changed = [];
  const added = [];
  const unchanged = [];

  const currentPaths = new Set(files.map((f) => f.path));
  const cachedPaths = new Set(Object.keys(cache.documents || {}));

  for (const file of files) {
    try {
      const mtime = statSync(file.path).mtimeMs;
      const cached = cache.documents?.[file.path];

      if (!cached) {
        added.push({ file, mtime });
      } else if (mtime > cache.cachedAt) {
        changed.push({ file, mtime });
      } else {
        unchanged.push({ file, cached });
      }
    } catch {
      // File doesn't exist or can't be read, treat as added
      added.push({ file, mtime: 0 });
    }
  }

  // Files in cache but not in current file list
  const removed = [...cachedPaths].filter((p) => !currentPaths.has(p));

  return { changed, added, removed, unchanged };
}

/**
 * Parse a single file into a document
 * @param {object} file - File object with path and relativePath
 * @param {number} mtime - File modification time
 * @returns {object} - Parsed document
 */
function parseFileToDocument(file, mtime) {
  const parsed = parseMarkdownFile(file.path);
  const title = parsed.frontmatter.title
    || extractFirstHeading(parsed.body)
    || file.relativePath;
  return {
    _path: file.path, // Internal: absolute path for cache key
    file: file.relativePath,
    title,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    tags: parsed.frontmatter.tags || [],
    description: parsed.frontmatter.description || '',
    mtime,
  };
}

/**
 * Check if in-memory document cache is still valid
 * Within TTL, trusts the cache without re-checking file mtimes for performance
 * @param {Array} files - Current files to check
 * @returns {boolean} - True if cache is valid
 */
function isDocumentCacheValid(files) {
  if (!documentCache) return false;

  // Check TTL - within TTL, trust the cache
  const age = Date.now() - documentCacheTimestamp;
  if (age > DOCUMENT_CACHE_TTL) return false;

  // Quick check: file count must match
  if (documentCache.length !== files.length) return false;

  // Within TTL, trust the in-memory cache without expensive stat calls
  return true;
}

/**
 * Parse documents with incremental delta updates
 * Only re-parses files that have changed since last cache
 * @param {Array} files - Files to parse
 * @param {object} config - Configuration object
 * @param {object} options - Options: { forceRebuild, silent }
 * @returns {Array} - Array of parsed documents
 */
function parseDocumentsWithDelta(files, config, options = {}) {
  const { forceRebuild = false, silent = false } = options;

  // Fast path: check in-memory cache first (no disk I/O)
  if (!forceRebuild && isDocumentCacheValid(files)) {
    return documentCache;
  }

  // Load disk cache for delta detection
  const cachePath = getDocumentCachePath(config);
  const cache = loadDocumentCache(cachePath);

  // Detect changes
  const { changed, added, removed, unchanged } = detectChanges(files, cache);
  const needsRefresh = changed.length > 0 || added.length > 0 || removed.length > 0;

  // User feedback
  if (needsRefresh && !silent) {
    const total = changed.length + added.length;
    if (removed.length > 0) {
      process.stderr.write(`Refreshing index (${total} changed, ${removed.length} removed)...\n`);
    } else if (total > 0) {
      process.stderr.write(`Refreshing index (${total} file${total !== 1 ? 's' : ''} changed)...\n`);
    }
  }

  // Build documents array
  const documents = [];

  // Reuse unchanged documents from cache
  for (const { cached } of unchanged) {
    documents.push(cached);
  }

  // Parse changed files
  for (const { file, mtime } of changed) {
    documents.push(parseFileToDocument(file, mtime));
  }

  // Parse new files
  for (const { file, mtime } of added) {
    documents.push(parseFileToDocument(file, mtime));
  }

  // Save updated cache to disk if there were changes
  if (needsRefresh) {
    saveDocumentCache(cachePath, documents);
  }

  // Update in-memory cache
  documentCache = documents;
  documentCacheTimestamp = Date.now();

  return documents;
}

/**
 * Check if Fuse index is still fresh using timestamp-based comparison
 * @param {string} metaPath - Path to metadata file
 * @param {Array} files - Current files to search
 * @param {object} docCache - Document cache for timestamp reference
 * @returns {boolean} - True if index is fresh
 */
function isFuseIndexFresh(metaPath, files, docCache) {
  try {
    if (!existsSync(metaPath)) {
      return false;
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

    // Check version
    if (meta.version !== INDEX_VERSION) {
      return false;
    }

    // Check file count
    if (meta.fileCount !== files.length) {
      return false;
    }

    // Use document cache timestamp if available and index was built after cache
    if (docCache.cachedAt > 0 && meta.timestamp >= docCache.cachedAt) {
      return true;
    }

    // Fall back to checking if any files changed since index was built
    for (const file of files) {
      try {
        const mtime = statSync(file.path).mtimeMs;
        if (mtime > meta.timestamp) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Build or load Fuse.js index with caching and delta updates
 * @param {Array} files - Files to index
 * @param {object} config - Configuration object
 * @param {boolean|object} forceRebuildOrOptions - Force rebuild flag or options object
 * @returns {{fuse: Fuse, documents: Array}} - Fuse instance and documents
 */
export function buildOrLoadIndex(files, config, forceRebuildOrOptions = false) {
  // Support both old API (boolean) and new API (options object)
  const options = typeof forceRebuildOrOptions === 'object'
    ? forceRebuildOrOptions
    : { forceRebuild: forceRebuildOrOptions };
  const { forceRebuild = false, silent = false } = options;

  const indexConfig = config.index || DEFAULT_CONFIG.index;
  const fuzzyConfig = config.fuzzy || DEFAULT_CONFIG.fuzzy;
  const weights = fuzzyConfig.weights || DEFAULT_CONFIG.fuzzy.weights;
  const keys = buildFuseKeys(weights);

  const fuseOptions = {
    keys,
    threshold: fuzzyConfig.threshold || 0.4,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    useExtendedSearch: true,
    ignoreLocation: fuzzyConfig.ignoreLocation !== false,
    ignoreFieldNorm: fuzzyConfig.ignoreFieldNorm !== false,
    distance: fuzzyConfig.distance || 100,
  };

  const indexPath = getIndexFilePath(config);
  const metaPath = getIndexMetaPath(config);
  const cachePath = getDocumentCachePath(config);

  // Parse documents with delta updates
  const documents = parseDocumentsWithDelta(files, config, { forceRebuild, silent });

  // If indexing is disabled, return fresh Fuse instance
  if (!indexConfig.enabled) {
    const fuse = new Fuse(documents, fuseOptions);
    return { fuse, documents };
  }

  // Load document cache for timestamp reference
  const docCache = loadDocumentCache(cachePath);

  // Check if we can use cached Fuse index
  if (!forceRebuild && isFuseIndexFresh(metaPath, files, docCache)) {
    try {
      const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
      const index = Fuse.parseIndex(indexData);
      const fuse = new Fuse(documents, fuseOptions, index);
      return { fuse, documents };
    } catch {
      // Failed to load cached index, rebuild
    }
  }

  // Build new index
  const index = Fuse.createIndex(keys, documents);
  const fuse = new Fuse(documents, fuseOptions, index);

  // Save index and metadata
  try {
    writeFileSync(indexPath, JSON.stringify(index.toJSON()));
    writeFileSync(
      metaPath,
      JSON.stringify({
        version: INDEX_VERSION,
        timestamp: Date.now(),
        fileCount: files.length,
      })
    );
  } catch {
    // Ignore write errors (e.g., read-only filesystem)
  }

  return { fuse, documents };
}

/**
 * Clear document cache (useful for testing)
 */
export function clearDocumentCache() {
  documentCache = null;
  documentCacheTimestamp = 0;
}

/**
 * Clear the Fuse.js index cache and document cache
 * @param {object} config - Configuration object
 * @returns {boolean} - True if any cache was cleared
 */
export function clearIndexCache(config) {
  const indexPath = getIndexFilePath(config);
  const metaPath = getIndexMetaPath(config);
  const docCachePath = getDocumentCachePath(config);
  let cleared = false;

  try {
    if (existsSync(indexPath)) {
      unlinkSync(indexPath);
      cleared = true;
    }
    if (existsSync(metaPath)) {
      unlinkSync(metaPath);
      cleared = true;
    }
    if (existsSync(docCachePath)) {
      unlinkSync(docCachePath);
      cleared = true;
    }
  } catch {
    // Ignore errors
  }

  // Also clear in-memory cache
  clearDocumentCache();

  return cleared;
}

/**
 * Get index statistics
 * @param {object} config - Configuration object
 * @returns {object} - Index stats
 */
export function getIndexStats(config) {
  const indexPath = getIndexFilePath(config);
  const metaPath = getIndexMetaPath(config);
  const indexConfig = config.index || DEFAULT_CONFIG.index;

  const stats = {
    enabled: indexConfig.enabled !== false,
    indexPath,
    metaPath,
    indexExists: existsSync(indexPath),
    metaExists: existsSync(metaPath),
    fileCount: 0,
    timestamp: null,
    age: null,
  };

  if (stats.metaExists) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      stats.fileCount = meta.fileCount || 0;
      stats.timestamp = meta.timestamp;
      stats.age = meta.timestamp
        ? Math.round((Date.now() - meta.timestamp) / 1000)
        : null;
    } catch {
      // Ignore parse errors
    }
  }

  return stats;
}

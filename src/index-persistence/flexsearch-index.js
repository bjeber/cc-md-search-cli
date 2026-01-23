/**
 * FlexSearch index persistence system
 *
 * Uses FlexSearch Document index for searching and document storage
 * Uses a small meta.json file for change detection
 * All files stored in .ccmds-flexsearch/ directory
 */

import {
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { Document } from 'flexsearch';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { parseMarkdownFile } from '../parsing/markdown.js';
import { extractFirstHeading } from '../parsing/headings.js';

export const INDEX_VERSION = 5; // Bumped for FlexSearch-only storage

// In-memory caches
let indexCache = null;
let indexCacheTimestamp = 0;
const INDEX_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get FlexSearch storage directory path
 * @param {object} config - Configuration object
 * @returns {string} - FlexSearch storage directory path
 */
export function getFlexSearchExportPath(config) {
  const baseDir = config._configDir || process.cwd();
  return join(baseDir, '.ccmds-flexsearch');
}

// Legacy exports for compatibility
export const getIndexFilePath = getFlexSearchExportPath;
export const getIndexMetaPath = getFlexSearchExportPath;
export const getDocumentCachePath = getFlexSearchExportPath;

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
 * Load metadata from meta.json
 * @param {string} exportPath - FlexSearch storage directory
 * @returns {object|null} - Metadata object or null
 */
function loadMeta(exportPath) {
  try {
    const metaPath = join(exportPath, 'meta.json');
    if (!existsSync(metaPath)) return null;
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Save metadata to meta.json
 * @param {string} exportPath - FlexSearch storage directory
 * @param {object} meta - Metadata object
 */
function saveMeta(exportPath, meta) {
  mkdirSync(exportPath, { recursive: true });
  writeFileSync(join(exportPath, 'meta.json'), JSON.stringify(meta, null, 2));
}

/**
 * Check if the cached index is still fresh
 * @param {string} exportPath - FlexSearch storage directory
 * @param {Array} files - Current files to search
 * @returns {boolean} - True if index is fresh
 */
export function isIndexFresh(exportPath, files) {
  try {
    const meta = loadMeta(exportPath);
    if (!meta) return false;

    // Check version
    if (meta.version !== INDEX_VERSION) return false;

    // Check file count
    if (meta.fileCount !== files.length) return false;

    // Check all files still exist and have same hash
    const storedHashes = meta.hashes || {};
    for (const file of files) {
      const storedHash = storedHashes[file.path];
      if (!storedHash) return false;
      const currentHash = computeFileHash(file.path);
      if (currentHash !== storedHash) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which files have changed since last cache
 * @param {Array} files - Current files to check
 * @param {object} storedHashes - Previously stored file hashes
 * @returns {object} - Object with changed, added, removed, and unchanged arrays
 */
function detectChanges(files, storedHashes) {
  const changed = [];
  const added = [];
  const unchanged = [];

  const currentPaths = new Set(files.map((f) => f.path));
  const storedPaths = new Set(Object.keys(storedHashes));

  for (const file of files) {
    const currentHash = computeFileHash(file.path);
    const storedHash = storedHashes[file.path];

    if (!storedHash) {
      added.push({ file, hash: currentHash });
    } else if (currentHash !== storedHash) {
      changed.push({ file, hash: currentHash });
    } else {
      unchanged.push({ file, hash: storedHash });
    }
  }

  // Files in cache but not in current file list
  const removed = [...storedPaths].filter((p) => !currentPaths.has(p));

  return { changed, added, removed, unchanged };
}

/**
 * Build FlexSearch keys configuration from weights
 * @param {object} weights - Field weights
 * @returns {Array} - FlexSearch index field configuration
 */
export function buildFlexSearchFields(weights) {
  return [
    { field: 'title', tokenize: 'forward', resolution: 9 },
    { field: 'description', tokenize: 'forward', resolution: 6 },
    { field: 'tags', tokenize: 'forward', resolution: 6 },
    { field: 'body', tokenize: 'forward', resolution: 3 },
  ];
}

// Legacy export for compatibility
export const buildFuseKeys = buildFlexSearchFields;

/**
 * Create FlexSearch Document index
 * @param {object} config - Configuration object
 * @returns {Document} - FlexSearch Document instance
 */
function createFlexSearchIndex(config) {
  const fuzzyConfig = config.fuzzy || DEFAULT_CONFIG.fuzzy;
  const weights = fuzzyConfig.weights || DEFAULT_CONFIG.fuzzy.weights;

  return new Document({
    tokenize: 'forward',
    resolution: 9,
    document: {
      id: 'id',
      index: buildFlexSearchFields(weights),
      store: [
        'file',
        'title',
        'body',
        'description',
        'tags',
        'frontmatter',
        'hash',
      ],
    },
  });
}

/**
 * Parse a single file into a document
 * @param {object} file - File object with path and relativePath
 * @param {string} hash - File hash
 * @returns {object} - Parsed document
 */
function parseFileToDocument(file, hash) {
  const parsed = parseMarkdownFile(file.path);
  const title =
    parsed.frontmatter.title ||
    extractFirstHeading(parsed.body) ||
    file.relativePath;

  return {
    id: file.path,
    file: file.relativePath,
    title,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    tags: Array.isArray(parsed.frontmatter.tags)
      ? parsed.frontmatter.tags.join(' ')
      : parsed.frontmatter.tags || '',
    description: parsed.frontmatter.description || '',
    hash,
  };
}

/**
 * Export FlexSearch index to disk
 * @param {Document} index - FlexSearch Document instance
 * @param {string} exportPath - Directory to export to
 * @param {object} meta - Metadata to save
 */
async function exportFlexSearchIndex(index, exportPath, meta) {
  mkdirSync(exportPath, { recursive: true });

  // FlexSearch async export with sync file writes
  // Wait for all export chunks to complete
  await index.export((key, data) => {
    writeFileSync(join(exportPath, `${key}.json`), data ?? '');
  });

  // Save metadata
  saveMeta(exportPath, meta);
}

/**
 * Import FlexSearch index from disk
 * @param {object} config - Configuration object
 * @param {string} exportPath - Directory to import from
 * @param {object} options - Options (silent: boolean)
 * @returns {Document|null} - FlexSearch Document instance or null if import fails
 */
function importFlexSearchIndex(config, exportPath, options = {}) {
  if (!existsSync(exportPath)) return null;

  try {
    const index = createFlexSearchIndex(config);
    const files = readdirSync(exportPath).filter(
      (f) => f.endsWith('.json') && f !== 'meta.json'
    );

    if (files.length === 0) return null;

    // Only show progress for larger indexes (controlled by caller via showProgress option)
    const showProgress = options.showProgress === true;

    for (const file of files) {
      const key = file.replace('.json', '');
      const data = readFileSync(join(exportPath, file), 'utf8');
      index.import(key, data || null);

      if (showProgress) {
        process.stderr.write('.');
      }
    }

    return index;
  } catch {
    return null;
  }
}

/**
 * Load documents from FlexSearch store
 * @param {Document} index - FlexSearch Document instance
 * @param {object} meta - Metadata with file paths
 * @returns {Array} - Array of document objects
 */
function loadDocumentsFromIndex(index, meta) {
  const documents = [];
  const paths = Object.keys(meta.hashes || {});

  for (const path of paths) {
    const doc = index.get(path);
    if (doc) {
      documents.push({
        id: path,
        file: doc.file,
        title: doc.title,
        body: doc.body,
        description: doc.description || '',
        tags: doc.tags || '',
        frontmatter: doc.frontmatter || {},
        hash: doc.hash,
      });
    }
  }

  return documents;
}

/**
 * Build or load FlexSearch index with caching
 * @param {Array} files - Files to index
 * @param {object} config - Configuration object
 * @param {boolean|object} forceRebuildOrOptions - Force rebuild flag or options object
 * @returns {Promise<{index: Document, documents: Array}>} - FlexSearch instance and documents
 */
export async function buildOrLoadIndex(files, config, forceRebuildOrOptions = false) {
  const options =
    typeof forceRebuildOrOptions === 'object'
      ? forceRebuildOrOptions
      : { forceRebuild: forceRebuildOrOptions };
  const { forceRebuild = false, silent = false } = options;

  const indexConfig = config.index || DEFAULT_CONFIG.index;
  const exportPath = getFlexSearchExportPath(config);

  // Check in-memory cache first
  if (
    !forceRebuild &&
    indexCache &&
    Date.now() - indexCacheTimestamp < INDEX_CACHE_TTL
  ) {
    const currentPaths = files
      .map((f) => f.path)
      .sort()
      .join('\n');
    const cachedPaths = indexCache.documents
      .map((d) => d.id)
      .sort()
      .join('\n');
    if (currentPaths === cachedPaths) {
      return { index: indexCache.index, documents: indexCache.documents };
    }
  }

  // FAST PATH: Check if cached index is fresh
  if (!forceRebuild && indexConfig.enabled && existsSync(exportPath)) {
    const meta = loadMeta(exportPath);

    if (
      meta &&
      meta.version === INDEX_VERSION &&
      meta.fileCount === files.length
    ) {
      // Quick check: compare hashes
      const storedHashes = meta.hashes || {};
      let allFresh = true;

      for (const file of files) {
        const currentHash = computeFileHash(file.path);
        if (storedHashes[file.path] !== currentHash) {
          allFresh = false;
          break;
        }
      }

      if (allFresh) {
        const showProgress = !silent && files.length >= 100;

        if (showProgress) {
          process.stderr.write(
            `Loading cached index (${files.length} files)...`
          );
        }

        const index = importFlexSearchIndex(config, exportPath, {
          silent,
          showProgress,
        });

        if (index) {
          const documents = loadDocumentsFromIndex(index, meta);

          if (showProgress) {
            process.stderr.write(' done\n');
          }

          indexCache = { index, documents };
          indexCacheTimestamp = Date.now();
          return { index, documents };
        }
      }
    }
  }

  // If indexing is disabled, create fresh index without persisting
  if (!indexConfig.enabled) {
    const index = createFlexSearchIndex(config);
    const documents = [];

    for (const file of files) {
      const hash = computeFileHash(file.path);
      const doc = parseFileToDocument(file, hash);
      documents.push(doc);
      index.add(doc);
    }

    return { index, documents };
  }

  // Delete old cache files
  deleteOldCacheFiles(config);

  // Build new index
  if (!silent) {
    process.stderr.write(`Building index (${files.length} files)...`);
  }

  const index = createFlexSearchIndex(config);
  const documents = [];
  const hashes = {};
  const showProgress = !silent && files.length >= 100;
  const progressInterval = Math.max(1, Math.floor(files.length / 10));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const hash = computeFileHash(file.path);
    const doc = parseFileToDocument(file, hash);

    documents.push(doc);
    hashes[file.path] = hash;
    index.add(doc);

    if (showProgress && (i + 1) % progressInterval === 0) {
      process.stderr.write('.');
    }
  }

  if (!silent) {
    process.stderr.write(' done\n');
  }

  // Export index and metadata
  const meta = {
    version: INDEX_VERSION,
    timestamp: Date.now(),
    fileCount: files.length,
    hashes,
  };

  await exportFlexSearchIndex(index, exportPath, meta);

  // Update in-memory cache
  indexCache = { index, documents };
  indexCacheTimestamp = Date.now();

  return { index, documents };
}

/**
 * Delete old cache files from previous versions
 * @param {object} config - Configuration object
 */
function deleteOldCacheFiles(config) {
  const baseDir = config._configDir || process.cwd();
  const oldFiles = [
    join(baseDir, '.ccmds-fuse-index.json'),
    join(baseDir, '.ccmds-fuse-index-meta.json'),
    join(baseDir, '.ccmds-docs-cache.json'),
    join(baseDir, '.ccmds-index.db'),
    join(baseDir, '.ccmds-index.db-wal'),
    join(baseDir, '.ccmds-index.db-shm'),
  ];

  for (const filePath of oldFiles) {
    try {
      if (existsSync(filePath)) {
        rmSync(filePath);
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Clear document cache (useful for testing)
 */
export function clearDocumentCache() {
  indexCache = null;
  indexCacheTimestamp = 0;
}

/**
 * Clear the index cache
 * @param {object} config - Configuration object
 * @returns {boolean} - True if any cache was cleared
 */
export function clearIndexCache(config) {
  const exportPath = getFlexSearchExportPath(config);
  let cleared = false;

  try {
    if (existsSync(exportPath)) {
      rmSync(exportPath, { recursive: true });
      cleared = true;
    }
  } catch {
    // Ignore errors
  }

  // Also delete old cache files
  deleteOldCacheFiles(config);

  // Clear in-memory cache
  clearDocumentCache();

  return cleared;
}

/**
 * Get index statistics
 * @param {object} config - Configuration object
 * @returns {object} - Index stats
 */
export function getIndexStats(config) {
  const exportPath = getFlexSearchExportPath(config);
  const indexConfig = config.index || DEFAULT_CONFIG.index;

  const stats = {
    enabled: indexConfig.enabled !== false,
    indexPath: exportPath,
    metaPath: join(exportPath, 'meta.json'),
    indexExists: existsSync(exportPath),
    metaExists: existsSync(join(exportPath, 'meta.json')),
    fileCount: 0,
    timestamp: null,
    age: null,
  };

  if (stats.metaExists) {
    try {
      const meta = loadMeta(exportPath);
      if (meta) {
        stats.fileCount = meta.fileCount || 0;
        stats.timestamp = meta.timestamp || null;
        stats.age = stats.timestamp
          ? Math.round((Date.now() - stats.timestamp) / 1000)
          : null;
      }
    } catch {
      // Ignore errors
    }
  }

  return stats;
}

/**
 * Fuse.js index persistence system
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import Fuse from 'fuse.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { parseMarkdownFile } from '../parsing/markdown.js';

export const INDEX_VERSION = 1;

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
 * Build or load Fuse.js index with caching
 * @param {Array} files - Files to index
 * @param {object} config - Configuration object
 * @param {boolean} forceRebuild - Force index rebuild
 * @returns {{fuse: Fuse, documents: Array}} - Fuse instance and documents
 */
export function buildOrLoadIndex(files, config, forceRebuild = false) {
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

  // Parse all documents (needed for both building index and returning results)
  const documents = files.map((file) => {
    const parsed = parseMarkdownFile(file.path);
    return {
      file: file.relativePath,
      title: parsed.frontmatter.title || file.relativePath,
      body: parsed.body,
      frontmatter: parsed.frontmatter,
      tags: parsed.frontmatter.tags || [],
      description: parsed.frontmatter.description || '',
    };
  });

  // If indexing is disabled, return fresh Fuse instance
  if (!indexConfig.enabled) {
    const fuse = new Fuse(documents, fuseOptions);
    return { fuse, documents };
  }

  const indexPath = getIndexFilePath(config);
  const metaPath = getIndexMetaPath(config);

  // Check if we can use cached index
  if (!forceRebuild && isIndexFresh(metaPath, files)) {
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
        fileHashes: computeFileHashes(files),
      })
    );
  } catch {
    // Ignore write errors (e.g., read-only filesystem)
  }

  return { fuse, documents };
}

/**
 * Clear the Fuse.js index cache
 * @param {object} config - Configuration object
 * @returns {boolean} - True if index was cleared
 */
export function clearIndexCache(config) {
  const indexPath = getIndexFilePath(config);
  const metaPath = getIndexMetaPath(config);
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
  } catch {
    // Ignore errors
  }

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

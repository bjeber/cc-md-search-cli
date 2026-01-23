/**
 * Search result cache system
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const CACHE_FILE = '.ccmds-cache.json';
const CACHE_VERSION = 1;

/**
 * Generate a cache key from command and options
 * @param {string} command - Command name
 * @param {object} params - Parameters to include in key
 * @returns {string} - Cache key hash
 */
export function generateCacheKey(command, params) {
  const keyData = JSON.stringify({ command, ...params });
  return createHash('md5').update(keyData).digest('hex').substring(0, 12);
}

/**
 * Get cache file path (in project root or config directory)
 * @param {object} config - Configuration object
 * @returns {string} - Cache file path
 */
export function getCacheFilePath(config) {
  const baseDir = config._configDir || process.cwd();
  return join(baseDir, CACHE_FILE);
}

/**
 * Read cache from file
 * @param {string} cachePath - Path to cache file
 * @returns {object} - Cache data or empty cache structure
 */
export function readCache(cachePath) {
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
export function writeCache(cachePath, cache) {
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
export function getCachedResult(config, cacheKey) {
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
export function setCachedResult(config, cacheKey, command, results) {
  if (!config.cache?.enabled) return;

  const cachePath = getCacheFilePath(config);
  const cache = readCache(cachePath);

  // Add new entry
  cache.entries[cacheKey] = {
    created: Date.now(),
    command,
    results,
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
export function clearCache(config) {
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
export function getCacheStats(config) {
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
    validEntries: entries.filter((e) => now - e.created < ttl).length,
    expiredEntries: entries.filter((e) => now - e.created >= ttl).length,
    commands: entries.reduce((acc, e) => {
      acc[e.command] = (acc[e.command] || 0) + 1;
      return acc;
    }, {}),
  };
}

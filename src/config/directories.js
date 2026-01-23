/**
 * Directory resolution utilities
 */

import { join, basename } from 'path';
import { homedir } from 'os';

/**
 * Normalize and deduplicate document directory entries
 * @param {Array} entries - Mixed array of strings and objects
 * @param {string} configDir - Base directory for resolving paths
 * @returns {Array} - Normalized directory objects with resolved paths
 */
export function normalizeDocumentDirectories(entries, configDir) {
  const usedNames = new Map(); // Track name usage for deduplication

  return entries.map((entry) => {
    const isObject = typeof entry === 'object' && entry !== null;
    const path = isObject ? entry.path : entry;
    const description = isObject ? entry.description || null : null;

    // Resolve the path
    let resolvedPath;
    if (path.startsWith('/')) {
      resolvedPath = path;
    } else if (path.startsWith('~')) {
      resolvedPath = path.replace(/^~/, homedir());
    } else {
      resolvedPath = join(configDir, path);
    }

    // Determine name (explicit or from basename)
    let baseName = isObject && entry.name ? entry.name : basename(resolvedPath);

    // Deduplicate names
    let name = baseName;
    const count = usedNames.get(baseName) || 0;
    if (count > 0) {
      name = `${baseName}-${count + 1}`;
    }
    usedNames.set(baseName, count + 1);

    return { name, path, resolvedPath, description };
  });
}

/**
 * Resolve directories from config (handles relative paths)
 * @param {string[]} directories - Directory paths from CLI or config
 * @param {object} config - Configuration object
 * @param {string} filterDoc - Optional doc name filter (prefix match)
 * @returns {Array} - Array of directory entry objects with name, path, resolvedPath, description
 */
export function resolveDirectories(directories, config, filterDoc = null) {
  const configDir = config._configDir || process.cwd();
  let entries;

  if (directories && directories.length > 0) {
    // CLI directories override config - wrap as entries
    if (filterDoc) {
      console.error(
        'Warning: --doc is ignored when directories are specified via CLI'
      );
    }
    entries = normalizeDocumentDirectories(
      directories.map((d) => ({ path: d })),
      process.cwd()
    );
  } else {
    entries = normalizeDocumentDirectories(
      config.documentDirectories,
      configDir
    );

    // Filter by doc name (prefix match, case-insensitive)
    if (filterDoc) {
      const filterLower = filterDoc.toLowerCase();
      entries = entries.filter((e) =>
        e.name.toLowerCase().startsWith(filterLower)
      );
      if (entries.length === 0) {
        console.error(
          `Documentation "${filterDoc}" not found. Use 'ccmds docs' to list available.`
        );
        process.exit(1);
      }
    }
  }

  return entries;
}

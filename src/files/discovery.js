/**
 * Markdown file discovery utilities
 */

import { readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { shouldExclude } from './glob.js';

/**
 * Recursively find all markdown files
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @param {object} options - Options (exclude patterns, extensions)
 * @param {boolean} isRecursive - Internal flag for recursive calls
 * @returns {Array} - Array of file objects
 */
export function findMarkdownFiles(
  dir,
  baseDir = dir,
  options = {},
  isRecursive = false
) {
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
      const hasValidExtension = extensions.some((ext) => item.endsWith(ext));
      if (hasValidExtension) {
        files.push({
          path: fullPath,
          relativePath,
        });
      }
    }
  }

  return files;
}

/**
 * Find markdown files from multiple directories
 * @param {Array} directoryEntries - Array of directory entries (objects with resolvedPath, name) or strings
 * @param {object} options - Options (exclude patterns, extensions)
 * @returns {Array} - Array of file objects
 */
export function findMarkdownFilesFromDirs(directoryEntries, options = {}) {
  let allFiles = [];

  // Handle both legacy string arrays and new entry objects
  const entries = directoryEntries.map((entry) => {
    if (typeof entry === 'string') {
      return { resolvedPath: entry, path: entry, name: basename(entry) };
    }
    return entry;
  });

  for (const entry of entries) {
    try {
      const dir = entry.resolvedPath;
      const files = findMarkdownFiles(dir, dir, options);
      // Enrich files with docName for multi-doc scenarios
      const enrichedFiles = files.map((f) => ({
        ...f,
        docName: entry.name,
      }));
      // Prefix relative paths with directory name for multi-dir scenarios
      const prefixedFiles =
        entries.length > 1
          ? enrichedFiles.map((f) => ({
              ...f,
              relativePath: join(basename(dir), f.relativePath),
            }))
          : enrichedFiles;
      allFiles = allFiles.concat(prefixedFiles);
    } catch (err) {
      console.error(`Error reading directory '${entry.path}': ${err.message}`);
    }
  }
  return allFiles;
}

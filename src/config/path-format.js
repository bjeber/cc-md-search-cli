/**
 * Output path formatting utilities
 */

import { relative } from 'path';

/**
 * Format a file path based on pathFormat config
 * @param {string} fullPath - Absolute path to the file
 * @param {string} relativePath - Path relative to docs directory
 * @param {object} config - Configuration object
 * @returns {string} - Formatted path
 */
export function formatOutputPath(fullPath, relativePath, config) {
  const pathFormat = config.pathFormat || 'cwd';

  switch (pathFormat) {
    case 'absolute':
      return fullPath;
    case 'docs':
      return relativePath;
    case 'cwd':
    default:
      return relative(process.cwd(), fullPath) || fullPath;
  }
}

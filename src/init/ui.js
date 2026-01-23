/**
 * UI utilities for interactive init
 */

import chalk from 'chalk';
import ora from 'ora';

/**
 * Theme colors and styles
 */
export const theme = {
  // Colors
  primary: chalk.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  highlight: chalk.bold.white,

  // Semantic
  path: chalk.cyan,
  value: chalk.yellow,
  key: chalk.gray,
  heading: chalk.bold.cyan,
};

/**
 * Print a section heading
 * @param {string} text - Heading text
 */
export function printHeading(text) {
  console.log();
  console.log(theme.heading(text));
  console.log(theme.muted('─'.repeat(Math.min(text.length + 4, 50))));
}

/**
 * Print a success message
 * @param {string} text - Message text
 */
export function printSuccess(text) {
  console.log(theme.success('✓') + ' ' + text);
}

/**
 * Print an info message
 * @param {string} text - Message text
 */
export function printInfo(text) {
  console.log(theme.muted('  ' + text));
}

/**
 * Print a warning message
 * @param {string} text - Message text
 */
export function printWarning(text) {
  console.log(theme.warning('!') + ' ' + text);
}

/**
 * Print an error message
 * @param {string} text - Message text
 */
export function printError(text) {
  console.log(theme.error('✗') + ' ' + text);
}

/**
 * Format a path for display
 * @param {string} path - The path to format
 * @returns {string} - Formatted path
 */
export function formatPath(path) {
  return theme.path(path);
}

/**
 * Format a key-value pair for display
 * @param {string} key - The key
 * @param {*} value - The value
 * @returns {string} - Formatted pair
 */
export function formatKeyValue(key, value) {
  const formattedValue = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);
  return `${theme.key(key + ':')} ${theme.value(formattedValue)}`;
}

/**
 * Create a spinner
 * @param {string} text - Spinner text
 * @returns {ora.Ora} - Spinner instance
 */
export function createSpinner(text) {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Format config preview for display
 * @param {object} config - Configuration object
 * @returns {string} - Formatted preview
 */
export function formatConfigPreview(config) {
  const lines = [];

  // Document directories
  if (config.documentDirectories) {
    lines.push(theme.key('documentDirectories:'));
    for (const dir of config.documentDirectories) {
      if (typeof dir === 'string') {
        lines.push('  - ' + theme.path(dir));
      } else {
        lines.push('  - ' + theme.highlight(dir.name) + ': ' + theme.path(dir.path));
        if (dir.description) {
          lines.push('    ' + theme.muted(dir.description));
        }
      }
    }
  }

  // Exclude patterns
  if (config.exclude && config.exclude.length > 0) {
    lines.push(theme.key('exclude:'));
    for (const pattern of config.exclude) {
      lines.push('  - ' + theme.value(pattern));
    }
  }

  // Output mode
  if (config.outputMode) {
    lines.push(formatKeyValue('outputMode', config.outputMode));
  }

  // Limit
  if (config.limit !== undefined) {
    lines.push(formatKeyValue('limit', config.limit));
  }

  // Fuzzy settings
  if (config.fuzzy) {
    lines.push(theme.key('fuzzy:'));
    if (config.fuzzy.threshold !== undefined) {
      lines.push('  ' + formatKeyValue('threshold', config.fuzzy.threshold));
    }
  }

  // Extensions
  if (config.extensions) {
    lines.push(formatKeyValue('extensions', config.extensions.join(', ')));
  }

  // Cache
  if (config.cache) {
    lines.push(theme.key('cache:'));
    lines.push('  ' + formatKeyValue('enabled', config.cache.enabled));
    if (config.cache.enabled) {
      lines.push('  ' + formatKeyValue('ttl', config.cache.ttl + 's'));
      lines.push('  ' + formatKeyValue('maxEntries', config.cache.maxEntries));
    }
  }

  return lines.join('\n');
}

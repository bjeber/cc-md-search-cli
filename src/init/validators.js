/**
 * Validators for interactive init prompts
 */

import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

/**
 * Expand ~ to home directory
 * @param {string} path - Path that may contain ~
 * @returns {string} - Expanded path
 */
export function expandTilde(path) {
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~/, homedir());
  }
  return path;
}

/**
 * Validate a directory path
 * @param {string} value - The path to validate
 * @returns {true|string} - true if valid, error message if invalid
 */
export function validateDirectoryPath(value) {
  if (!value || !value.trim()) {
    return 'Please enter a directory path';
  }

  const trimmed = value.trim();
  const expanded = expandTilde(trimmed);
  const resolved = resolve(expanded);

  // Check for invalid characters (basic check)
  if (/[\x00-\x1f]/.test(trimmed)) {
    return 'Path contains invalid characters';
  }

  // Check if path exists and is a directory
  if (existsSync(resolved)) {
    try {
      const stats = statSync(resolved);
      if (!stats.isDirectory()) {
        return `'${trimmed}' exists but is not a directory`;
      }
    } catch {
      return `Cannot access '${trimmed}'`;
    }
  }

  // Path doesn't exist - that's okay, we'll offer to create it
  return true;
}

/**
 * Check if a directory exists
 * @param {string} path - The path to check
 * @returns {boolean} - true if exists and is directory
 */
export function directoryExists(path) {
  const expanded = expandTilde(path.trim());
  const resolved = resolve(expanded);

  if (!existsSync(resolved)) {
    return false;
  }

  try {
    return statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate a glob pattern
 * @param {string} value - The glob pattern to validate
 * @returns {true|string} - true if valid, error message if invalid
 */
export function validateGlobPattern(value) {
  if (!value || !value.trim()) {
    return 'Please enter a glob pattern';
  }

  const trimmed = value.trim();

  // Check for balanced braces
  let braceCount = 0;
  for (const char of trimmed) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) {
      return 'Unbalanced braces in pattern';
    }
  }
  if (braceCount !== 0) {
    return 'Unbalanced braces in pattern';
  }

  // Check for balanced brackets
  let bracketCount = 0;
  for (const char of trimmed) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (bracketCount < 0) {
      return 'Unbalanced brackets in pattern';
    }
  }
  if (bracketCount !== 0) {
    return 'Unbalanced brackets in pattern';
  }

  // Check for null bytes
  if (/\x00/.test(trimmed)) {
    return 'Pattern contains invalid characters';
  }

  return true;
}

/**
 * Create a number range validator
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {function(string): true|string} - Validator function
 */
export function validateNumberInRange(min, max) {
  return (value) => {
    const num = Number(value);

    if (isNaN(num)) {
      return 'Please enter a valid number';
    }

    if (!Number.isInteger(num)) {
      return 'Please enter a whole number';
    }

    if (num < min || num > max) {
      return `Please enter a number between ${min} and ${max}`;
    }

    return true;
  };
}

/**
 * Validate fuzzy threshold (0-1)
 * @param {string} value - The threshold value
 * @returns {true|string} - true if valid, error message if invalid
 */
export function validateFuzzyThreshold(value) {
  const num = Number(value);

  if (isNaN(num)) {
    return 'Please enter a valid number';
  }

  if (num < 0 || num > 1) {
    return 'Threshold must be between 0 and 1';
  }

  return true;
}

/**
 * Validate directory name (for named directories)
 * @param {string} value - The name to validate
 * @returns {true|string} - true if valid, error message if invalid
 */
export function validateDirectoryName(value) {
  if (!value || !value.trim()) {
    return 'Please enter a name';
  }

  const trimmed = value.trim();

  // Allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return 'Name can only contain letters, numbers, hyphens, and underscores';
  }

  if (trimmed.length > 50) {
    return 'Name must be 50 characters or less';
  }

  return true;
}

/**
 * Validate file extensions input
 * @param {string} value - Comma-separated extensions
 * @returns {true|string} - true if valid, error message if invalid
 */
export function validateExtensions(value) {
  if (!value || !value.trim()) {
    return 'Please enter at least one extension';
  }

  const extensions = value.split(',').map(e => e.trim()).filter(Boolean);

  if (extensions.length === 0) {
    return 'Please enter at least one extension';
  }

  for (const ext of extensions) {
    if (!ext.startsWith('.')) {
      return `Extension '${ext}' must start with a dot (e.g., .md)`;
    }
    if (!/^\.[a-zA-Z0-9]+$/.test(ext)) {
      return `Invalid extension format: '${ext}'`;
    }
  }

  return true;
}

/**
 * Parse extensions string into array
 * @param {string} value - Comma-separated extensions
 * @returns {string[]} - Array of extensions
 */
export function parseExtensions(value) {
  return value.split(',').map(e => e.trim()).filter(Boolean);
}

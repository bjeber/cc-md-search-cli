/**
 * Glob pattern matching utilities
 */

/**
 * Check if a path matches any exclude pattern
 * @param {string} filePath - Path to check
 * @param {string[]} excludePatterns - Array of glob-like patterns
 * @returns {boolean} - True if path should be excluded
 */
export function shouldExclude(filePath, excludePatterns) {
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
export function matchGlobPattern(path, pattern) {
  // Normalize pattern
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Split pattern into segments
  const patternParts = normalizedPattern.split('/');
  const pathParts = path.split('/');

  return matchParts(pathParts, patternParts, 0, 0);
}

/**
 * Recursively match path parts against pattern parts
 * @param {string[]} pathParts - Path segments
 * @param {string[]} patternParts - Pattern segments
 * @param {number} pathIdx - Current path index
 * @param {number} patternIdx - Current pattern index
 * @returns {boolean} - True if match found
 */
export function matchParts(pathParts, patternParts, pathIdx, patternIdx) {
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
 * @param {string} segment - Path segment
 * @param {string} pattern - Pattern segment
 * @returns {boolean} - True if segment matches pattern
 */
export function matchSegment(segment, pattern) {
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

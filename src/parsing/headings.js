/**
 * Heading extraction and navigation utilities
 */

/**
 * Extract all headings from markdown
 * @param {string[]} lines - Array of lines from markdown body
 * @returns {Array<{level: number, text: string, line: number}>} - Array of heading objects
 */
export function extractHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i,
      });
    }
  }
  return headings;
}

/**
 * Extract the first heading (title) from markdown body
 * @param {string} body - Markdown body content
 * @returns {string|null} - First heading text or null
 */
export function extractFirstHeading(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      return match[2].trim();
    }
  }
  return null;
}

/**
 * Find nearest parent heading for a line
 * @param {Array<{level: number, text: string, line: number}>} headings - Array of headings
 * @param {number} lineIndex - Line index to find parent for
 * @returns {{level: number, text: string, line: number}|null} - Parent heading or null
 */
export function findParentHeading(headings, lineIndex) {
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex) {
      return headings[i];
    }
  }
  return null;
}

/**
 * Build heading path (e.g., "## Setup > ### Prerequisites")
 * @param {Array<{level: number, text: string, line: number}>} headings - Array of headings
 * @param {number} lineIndex - Line index to build path for
 * @returns {string} - Heading path string
 */
export function buildHeadingPath(headings, lineIndex) {
  const path = [];
  let currentLevel = 7;
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].line < lineIndex && headings[i].level < currentLevel) {
      path.unshift(`${'#'.repeat(headings[i].level)} ${headings[i].text}`);
      currentLevel = headings[i].level;
    }
  }
  return path.join(' > ');
}

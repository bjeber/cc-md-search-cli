/**
 * Grep-style search implementation
 */

import { DEFAULT_CONFIG } from '../config/constants.js';
import { parseMarkdownFile, filterFrontmatter } from '../parsing/markdown.js';
import { extractHeadings, buildHeadingPath } from '../parsing/headings.js';
import { extractSmartContext } from '../parsing/context.js';

/**
 * Grep-style search for exact text patterns
 * @param {Array} files - Array of file objects to search
 * @param {string} query - Search query (regex pattern)
 * @param {object} options - Search options
 * @param {number} options.context - Lines of context around matches
 * @param {boolean} options.caseSensitive - Case sensitive search
 * @param {boolean} options.raw - Disable smart context
 * @param {object} options.config - Configuration object
 * @returns {Array} - Array of search results
 */
export function grepSearch(files, query, options) {
  const config = options.config || DEFAULT_CONFIG;
  const results = [];

  let regex;
  try {
    regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
  } catch (err) {
    console.error(`Invalid regex pattern '${query}': ${err.message}`);
    return results;
  }

  for (const file of files) {
    const parsed = parseMarkdownFile(file.path);
    const lines = parsed.body.split('\n');
    const headings = extractHeadings(lines);
    const matches = [];
    const processedRanges = []; // For deduplication

    lines.forEach((line, index) => {
      if (regex.test(line)) {
        const { start, end } = options.raw
          ? {
              start: Math.max(0, index - options.context),
              end: Math.min(lines.length - 1, index + options.context),
            }
          : extractSmartContext(lines, index);

        // Skip if this range overlaps with already processed
        const overlaps = processedRanges.some(
          (r) =>
            (start >= r.start && start <= r.end) ||
            (end >= r.start && end <= r.end)
        );

        if (!overlaps) {
          processedRanges.push({ start, end });
          matches.push({
            lineNumber: index + 1,
            line: line.trim(),
            headingPath: options.raw ? null : buildHeadingPath(headings, index),
            context: lines.slice(start, end + 1).join('\n'),
            range: { start: start + 1, end: end + 1 },
          });
        }
      }
    });

    if (matches.length > 0) {
      results.push({
        file: file.relativePath,
        matches,
        frontmatter: options.raw
          ? parsed.frontmatter
          : filterFrontmatter(parsed.frontmatter, config),
      });
    }
  }

  return results;
}

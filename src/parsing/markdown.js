/**
 * Markdown file parsing utilities
 */

import { readFileSync } from 'fs';
import matter from 'gray-matter';
import { USEFUL_FRONTMATTER } from '../config/constants.js';

/**
 * Parse markdown file with frontmatter
 * @param {string} filePath - Path to markdown file
 * @returns {{filePath: string, frontmatter: object, body: string, fullContent: string}}
 */
export function parseMarkdownFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  return {
    filePath,
    frontmatter,
    body,
    fullContent: content,
  };
}

/**
 * Filter frontmatter to useful fields
 * @param {object} frontmatter - Full frontmatter object
 * @param {object} config - Configuration object (optional)
 * @returns {object} - Filtered frontmatter
 */
export function filterFrontmatter(frontmatter, config = null) {
  const fields = config?.frontmatterFields || USEFUL_FRONTMATTER;
  const filtered = {};
  for (const key of fields) {
    if (frontmatter[key] !== undefined) {
      filtered[key] = frontmatter[key];
    }
  }
  return filtered;
}

/**
 * Fuzzy search implementation
 */

import { DEFAULT_CONFIG } from '../config/constants.js';
import { filterFrontmatter } from '../parsing/markdown.js';
import { extractSmartContext } from '../parsing/context.js';
import { buildOrLoadIndex } from '../index-persistence/fuse-index.js';

// Minimum preview length threshold for short context extension
const MIN_PREVIEW_LENGTH = 80;

/**
 * Find the best (longest) match from Fuse.js indices
 * Fuse.js returns many small indices for fuzzy matches; we want the most significant one
 * @param {Array<[number, number]>} indices - Array of [start, end] pairs
 * @returns {{start: number, end: number, length: number} | null} - Best match position
 */
export function findBestMatchFromIndices(indices) {
  if (!indices || indices.length === 0) {
    return null;
  }

  // Find the longest match span
  let bestMatch = { start: indices[0][0], end: indices[0][1], length: indices[0][1] - indices[0][0] };

  for (const [start, end] of indices) {
    const length = end - start;
    if (length > bestMatch.length) {
      bestMatch = { start, end, length };
    }
  }

  return bestMatch;
}

/**
 * Convert character offset to line number
 * @param {string} text - Full text
 * @param {number} charOffset - Character offset
 * @returns {number} - Line number (0-indexed)
 */
export function charOffsetToLineNumber(text, charOffset) {
  let lineNumber = 0;
  let currentOffset = 0;

  for (const line of text.split('\n')) {
    if (currentOffset + line.length >= charOffset) {
      return lineNumber;
    }
    currentOffset += line.length + 1; // +1 for newline
    lineNumber++;
  }

  return lineNumber;
}

/**
 * Extract paragraph/section context around a match using smart boundaries
 * Enhanced to extend short previews (especially for title/heading matches)
 * @param {string} body - Full document body
 * @param {number} charOffset - Character offset of match
 * @param {number} maxLines - Maximum number of lines to include (default: 20)
 * @returns {string} - Context snippet (paragraph or code block)
 */
export function extractParagraphContext(body, charOffset, maxLines = 20) {
  const lines = body.split('\n');
  const matchLineIndex = charOffsetToLineNumber(body, charOffset);

  // Use extractSmartContext to find paragraph/code block boundaries
  // Enable extendShort to extend short previews (e.g., title/heading matches)
  const { start, end } = extractSmartContext(lines, matchLineIndex, {
    extendShort: true,
    minLength: MIN_PREVIEW_LENGTH,
    minLines: 3,
  });

  const contextLines = lines.slice(start, end + 1);

  // If context exceeds maxLines, truncate around the match
  if (contextLines.length > maxLines) {
    const matchLineInContext = matchLineIndex - start;

    // Distribute lines around the match (more after than before)
    const linesBefore = Math.floor(maxLines / 3);
    const linesAfter = maxLines - linesBefore - 1;

    let keepStart = Math.max(0, matchLineInContext - linesBefore);
    let keepEnd = Math.min(contextLines.length, matchLineInContext + linesAfter + 1);

    // Adjust if we hit boundaries
    if (keepStart === 0) {
      keepEnd = Math.min(contextLines.length, maxLines);
    } else if (keepEnd === contextLines.length) {
      keepStart = Math.max(0, contextLines.length - maxLines);
    }

    let context = contextLines.slice(keepStart, keepEnd).join('\n');

    if (keepStart > 0) {
      context = '...\n' + context;
    }
    if (keepEnd < contextLines.length) {
      context = context + '\n...';
    }

    return context.trim();
  }

  return contextLines.join('\n').trim();
}

/**
 * Extract preview for a title match (title + following paragraph)
 * @param {string} body - Document body
 * @param {string} title - Document title
 * @param {number} maxLines - Maximum lines to include
 * @returns {string} - Preview text
 */
function extractTitleMatchPreview(body, title, maxLines = 10) {
  const lines = body.split('\n');

  // Find the title line in the body
  let titleLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#{1,6}\s+(.+)$/);
    if (match && match[1].trim() === title) {
      titleLineIndex = i;
      break;
    }
  }

  if (titleLineIndex === -1) {
    // Title not found in body, return first paragraph
    return extractParagraphContext(body, 0, maxLines);
  }

  // Extract title and following content (skip blank lines, get next paragraph)
  let endLine = titleLineIndex;
  let foundContent = false;

  for (let i = titleLineIndex + 1; i < lines.length && (endLine - titleLineIndex) < maxLines; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Stop at next heading
    if (line.match(/^#{1,6}\s/)) {
      break;
    }

    // Stop at code block
    if (line.startsWith('```')) {
      break;
    }

    // Skip initial blank lines
    if (!foundContent && trimmedLine === '') {
      continue;
    }

    // Found content
    foundContent = true;
    endLine = i;

    // Stop after first paragraph (blank line after content)
    if (foundContent && trimmedLine === '') {
      break;
    }
  }

  return lines.slice(titleLineIndex, endLine + 1).join('\n').trim();
}

/**
 * Fuzzy search for finding relevant documents
 * @param {Array} files - Array of file objects to search
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {number} options.limit - Maximum results to return
 * @param {boolean} options.raw - Disable adaptive previews
 * @param {object} options.config - Configuration object
 * @param {boolean} options.rebuildIndex - Force rebuild of search index
 * @returns {Array} - Array of search results
 */
export function fuzzySearch(files, query, options) {
  const config = options.config || DEFAULT_CONFIG;
  const previewConfig = config.preview || DEFAULT_CONFIG.preview;
  const forceRebuild = options.rebuildIndex || false;

  // Use cached index when possible
  const { fuse } = buildOrLoadIndex(files, config, forceRebuild);

  // Pass limit directly to Fuse.js to avoid scoring all matches
  const results = fuse.search(query, { limit: options.limit });

  return results.map((result, index) => {
    // Adaptive preview length based on rank (configurable)
    const previewLength = options.raw
      ? 200
      : index < 3
        ? previewConfig.topResults || 600
        : index < 7
          ? previewConfig.midResults || 300
          : previewConfig.otherResults || 150;

    let preview = '';
    const maxLines = previewConfig.maxLines || 20;

    // Check if match is in title field
    const titleMatch = result.matches?.find(m => m.key === 'title');
    const bodyMatch = result.matches?.find(m => m.key === 'body');

    if (titleMatch && (!bodyMatch || titleMatch.indices?.[0]?.[1] - titleMatch.indices?.[0]?.[0] >= 2)) {
      // Title match: show title + following paragraph
      preview = extractTitleMatchPreview(result.item.body, result.item.title, maxLines);
    } else if (bodyMatch && bodyMatch.indices && bodyMatch.indices.length > 0) {
      // Body match: extract paragraph context around the match
      const bestMatch = findBestMatchFromIndices(bodyMatch.indices);
      if (bestMatch && bestMatch.length >= 2) {
        preview = extractParagraphContext(
          result.item.body,
          bestMatch.start,
          maxLines
        );
      }
    }

    if (!preview) {
      // Fall back to description or body start
      preview = result.item.description || '';
      if (preview.length < previewLength) {
        preview = result.item.body.substring(0, previewLength);
      }
      if (preview.length >= previewLength) {
        preview =
          preview.substring(0, previewLength).replace(/\s+\S*$/, '') + '...';
      }
    }

    return {
      file: result.item.file,
      score: result.score,
      title: result.item.title,
      frontmatter: options.raw
        ? result.item.frontmatter
        : filterFrontmatter(result.item.frontmatter, config),
      preview,
    };
  });
}

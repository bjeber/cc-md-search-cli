/**
 * Fuzzy search implementation using FlexSearch
 */

import { DEFAULT_CONFIG } from '../config/constants.js';
import { filterFrontmatter } from '../parsing/markdown.js';
import { extractSmartContext } from '../parsing/context.js';
import { buildOrLoadIndex } from '../index-persistence/flexsearch-index.js';

// Minimum preview length threshold for short context extension
const MIN_PREVIEW_LENGTH = 80;

/**
 * Parse extended search query into terms
 * Supports Fuse.js-style operators:
 * - 'term - exact substring match
 * - !term - exclude results containing term
 * - space - AND (all terms must match)
 *
 * @param {string} query - Raw query string
 * @returns {{includes: string[], excludes: string[], exact: string[]}}
 */
function parseExtendedQuery(query) {
  const includes = [];
  const excludes = [];
  const exact = [];

  // Split by spaces but preserve quoted strings
  const parts = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (const part of parts) {
    if (part.startsWith("'")) {
      // Exact match - remove the prefix
      exact.push(part.slice(1));
    } else if (part.startsWith('!')) {
      // Negation - remove the prefix
      excludes.push(part.slice(1).toLowerCase());
    } else {
      // Normal search term
      includes.push(part);
    }
  }

  return { includes, excludes, exact };
}

/**
 * Check if a document matches exact terms
 * @param {object} doc - Document to check
 * @param {string[]} exactTerms - Terms that must appear exactly
 * @returns {boolean}
 */
function matchesExactTerms(doc, exactTerms) {
  if (exactTerms.length === 0) return true;

  const searchText = [
    doc.title || '',
    doc.body || '',
    doc.description || '',
    doc.tags || '',
  ].join(' ');

  return exactTerms.every(term =>
    searchText.includes(term)
  );
}

/**
 * Check if a document matches exclusion terms
 * @param {object} doc - Document to check
 * @param {string[]} excludeTerms - Terms that must NOT appear
 * @returns {boolean} - True if document should be excluded
 */
function matchesExcludeTerms(doc, excludeTerms) {
  if (excludeTerms.length === 0) return false;

  const searchText = [
    doc.file || '',
    doc.title || '',
    doc.body || '',
    doc.description || '',
    doc.tags || '',
  ].join(' ').toLowerCase();

  return excludeTerms.some(term =>
    searchText.includes(term)
  );
}

/**
 * Find position of query term in text (for preview generation)
 * @param {string} text - Text to search
 * @param {string} query - Query to find
 * @returns {{start: number, end: number, length: number} | null}
 */
function findTermPosition(text, query) {
  if (!text || !query) return null;

  const textLower = text.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(t => !t.startsWith('!') && !t.startsWith("'"));

  // Find the first matching term
  for (const term of terms) {
    const cleanTerm = term.replace(/^['!]/, '');
    const index = textLower.indexOf(cleanTerm);
    if (index !== -1) {
      return {
        start: index,
        end: index + cleanTerm.length,
        length: cleanTerm.length,
      };
    }
  }

  return null;
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
 * Calculate a simple relevance score based on where matches are found
 * @param {object} doc - Document object
 * @param {string[]} terms - Search terms
 * @returns {number} - Score (lower is better, like Fuse.js)
 */
function calculateScore(doc, terms) {
  if (terms.length === 0) return 1;

  let score = 1;
  const titleLower = (doc.title || '').toLowerCase();
  const bodyLower = (doc.body || '').toLowerCase();
  const descLower = (doc.description || '').toLowerCase();
  const tagsLower = (doc.tags || '').toLowerCase();

  for (const term of terms) {
    const cleanTerm = term.toLowerCase().replace(/^['!]/, '');

    // Title matches are most important
    if (titleLower.includes(cleanTerm)) {
      score *= 0.1;
    }
    // Description and tags are next
    else if (descLower.includes(cleanTerm) || tagsLower.includes(cleanTerm)) {
      score *= 0.3;
    }
    // Body matches are least weighted
    else if (bodyLower.includes(cleanTerm)) {
      score *= 0.6;
    }
  }

  return Math.min(score, 0.99);
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

  // Parse extended search syntax
  const { includes, excludes, exact } = parseExtendedQuery(query);

  // Build search query for FlexSearch (use includes only)
  const searchQuery = includes.join(' ');

  // Use cached index when possible
  const { index, documents } = buildOrLoadIndex(files, config, forceRebuild);

  // If no search query and no exact terms, return empty
  if (!searchQuery && exact.length === 0) {
    return [];
  }

  let results;

  if (searchQuery) {
    // Split query into individual words for AND search
    const searchTerms = searchQuery.split(/\s+/).filter(t => t.length > 0);

    if (searchTerms.length === 0) {
      results = [];
    } else if (searchTerms.length === 1) {
      // Single term - simple search
      const searchResults = index.search(searchTerms[0], {
        limit: options.limit * 3,
        enrich: true,
      });

      const docMap = new Map();
      for (const fieldResult of searchResults) {
        if (fieldResult.result) {
          for (const item of fieldResult.result) {
            if (!docMap.has(item.id)) {
              docMap.set(item.id, item.doc);
            }
          }
        }
      }
      results = Array.from(docMap.values());
    } else {
      // Multiple terms - AND search (intersection of results)
      let intersectionIds = null;
      const docById = new Map();

      for (const term of searchTerms) {
        const termResults = index.search(term, {
          limit: 1000, // Get all matches for intersection
          enrich: true,
        });

        const termIds = new Set();
        for (const fieldResult of termResults) {
          if (fieldResult.result) {
            for (const item of fieldResult.result) {
              termIds.add(item.id);
              if (!docById.has(item.id)) {
                docById.set(item.id, item.doc);
              }
            }
          }
        }

        if (intersectionIds === null) {
          intersectionIds = termIds;
        } else {
          // Intersect: keep only IDs that appear in both sets
          intersectionIds = new Set([...intersectionIds].filter(id => termIds.has(id)));
        }
      }

      results = intersectionIds
        ? Array.from(intersectionIds).map(id => docById.get(id)).filter(Boolean)
        : [];
    }
  } else {
    // Only exact terms, search all documents
    results = documents;
  }

  // Apply exact match filter
  if (exact.length > 0) {
    results = results.filter(doc => matchesExactTerms(doc, exact));
  }

  // Apply exclusion filter
  if (excludes.length > 0) {
    results = results.filter(doc => !matchesExcludeTerms(doc, excludes));
  }

  // Calculate scores and sort
  const allTerms = [...includes, ...exact];
  results = results.map(doc => ({
    doc,
    score: calculateScore(doc, allTerms),
  }));

  // Sort by score (lower is better)
  results.sort((a, b) => a.score - b.score);

  // Apply limit
  results = results.slice(0, options.limit);

  return results.map((result, index) => {
    const doc = result.doc;

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

    // Check if query matches title
    const queryLower = query.toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();
    const isTitleMatch = allTerms.some(term =>
      titleLower.includes(term.toLowerCase().replace(/^['!]/, ''))
    );

    // Find match position in body
    const bodyMatch = findTermPosition(doc.body, query);

    if (isTitleMatch && (!bodyMatch || bodyMatch.length < 3)) {
      // Title match: show title + following paragraph
      preview = extractTitleMatchPreview(doc.body, doc.title, maxLines);
    } else if (bodyMatch && bodyMatch.length >= 2) {
      // Body match: extract paragraph context around the match
      preview = extractParagraphContext(
        doc.body,
        bodyMatch.start,
        maxLines
      );
    }

    if (!preview) {
      // Fall back to description or body start
      preview = doc.description || '';
      if (preview.length < previewLength) {
        preview = doc.body.substring(0, previewLength);
      }
      if (preview.length >= previewLength) {
        preview =
          preview.substring(0, previewLength).replace(/\s+\S*$/, '') + '...';
      }
    }

    // Parse frontmatter from doc (it's stored as JSON string in tags, actual frontmatter in frontmatter field)
    const frontmatter = doc.frontmatter || {};

    return {
      file: doc.file,
      score: result.score,
      title: doc.title,
      frontmatter: options.raw
        ? frontmatter
        : filterFrontmatter(frontmatter, config),
      preview,
    };
  });
}

// Legacy export for compatibility with tests that might use it
export function findBestMatchFromIndices(indices) {
  if (!indices || indices.length === 0) {
    return null;
  }

  let bestMatch = { start: indices[0][0], end: indices[0][1], length: indices[0][1] - indices[0][0] };

  for (const [start, end] of indices) {
    const length = end - start;
    if (length > bestMatch.length) {
      bestMatch = { start, end, length };
    }
  }

  return bestMatch;
}

/**
 * Smart context extraction for search results
 */

// Minimum preview length threshold for short context extension
const MIN_PREVIEW_LENGTH = 80;
const MIN_PREVIEW_LINES = 3;

/**
 * Extract smart context (paragraph boundaries, preserve code blocks)
 * Can optionally extend short previews (especially for title/heading matches)
 * @param {string[]} lines - Array of lines from markdown body
 * @param {number} matchIndex - Line index where match occurred
 * @param {object} options - Options for context extraction
 * @param {boolean} options.extendShort - Enable extension of short previews (default: false)
 * @param {number} options.minLength - Minimum character length for preview (when extendShort=true)
 * @param {number} options.minLines - Minimum lines for preview (when extendShort=true)
 * @returns {{start: number, end: number}} - Start and end line indices
 */
export function extractSmartContext(lines, matchIndex, options = {}) {
  const extendShort = options.extendShort || false;
  const minLength = options.minLength || MIN_PREVIEW_LENGTH;
  const minLines = options.minLines || MIN_PREVIEW_LINES;

  let start = matchIndex;
  let end = matchIndex;

  // Check if we're inside a code block
  let inCodeBlock = false;
  let codeBlockStart = -1;
  for (let i = 0; i <= matchIndex; i++) {
    if (lines[i].startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) codeBlockStart = i;
    }
  }

  if (inCodeBlock) {
    // Find code block boundaries
    start = codeBlockStart;
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('```')) {
        end = i;
        break;
      }
    }
  } else {
    // Find paragraph boundaries (blank lines or headings)
    for (let i = matchIndex - 1; i >= 0; i--) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        start = i + 1;
        break;
      }
      start = i;
    }
    for (let i = matchIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '' || lines[i].match(/^#{1,6}\s/)) {
        end = i - 1;
        break;
      }
      end = i;
    }
  }

  // Optionally extend short previews
  if (extendShort) {
    const contextLines = lines.slice(start, end + 1);
    const contextLength = contextLines.join('\n').length;
    const lineCount = contextLines.length;

    if (contextLength < minLength || lineCount < minLines) {
      // Extend to include next paragraph/section
      const extended = extendContextToNextParagraph(lines, start, end);
      start = extended.start;
      end = extended.end;
    }
  }

  return { start, end };
}

/**
 * Extend context to include the next paragraph when preview is too short
 * Stops at next heading or code block to avoid bleeding into unrelated content
 * @param {string[]} lines - Array of lines from markdown body
 * @param {number} currentStart - Current start line index
 * @param {number} currentEnd - Current end line index
 * @returns {{start: number, end: number}} - Extended start and end line indices
 */
function extendContextToNextParagraph(lines, currentStart, currentEnd) {
  let newEnd = currentEnd;
  let foundContent = false;
  let inExtendedParagraph = false;

  // Skip any blank lines after current end to find next paragraph
  for (let i = currentEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Stop at next heading
    if (line.match(/^#{1,6}\s/)) {
      break;
    }

    // Stop at code block start
    if (line.startsWith('```')) {
      break;
    }

    // Skip blank lines between paragraphs
    if (trimmedLine === '') {
      if (inExtendedParagraph) {
        // End of extended paragraph found
        break;
      }
      continue;
    }

    // Found content in next paragraph
    foundContent = true;
    inExtendedParagraph = true;
    newEnd = i;
  }

  return { start: currentStart, end: newEnd };
}

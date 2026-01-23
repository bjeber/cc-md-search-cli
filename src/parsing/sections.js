/**
 * Section extraction utilities
 */

/**
 * Get section content by heading
 * @param {string[]} lines - Array of lines from markdown body
 * @param {Array<{level: number, text: string, line: number}>} headings - Array of headings
 * @param {string} headingText - Heading text to find (supports path like "Installation > Prerequisites")
 * @returns {string|null} - Section content or null if not found
 */
export function extractSection(lines, headings, headingText) {
  // Support heading path like "Installation > Prerequisites"
  const pathParts = headingText
    .split('>')
    .map((p) => p.trim().replace(/^#+\s*/, ''));
  const targetHeading = pathParts[pathParts.length - 1].toLowerCase();

  let startIdx = -1;
  let startLevel = 0;

  for (const h of headings) {
    if (h.text.toLowerCase().includes(targetHeading)) {
      startIdx = h.line;
      startLevel = h.level;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find end (next heading of same or higher level)
  let endIdx = lines.length;
  for (const h of headings) {
    if (h.line > startIdx && h.level <= startLevel) {
      endIdx = h.line;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n');
}

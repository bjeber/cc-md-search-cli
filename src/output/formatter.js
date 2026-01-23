/**
 * Output formatting utilities
 */

/**
 * Format search results for output
 * @param {Array} results - Array of search results
 * @param {string} mode - Output mode: json, files, compact, detailed
 * @returns {string} - Formatted output string
 */
export function formatOutput(results, mode) {
  if (mode === 'json') {
    // Compact JSON optimized for AI consumption
    const compactResults = results.map((r) => {
      const out = { file: r.file };

      // Round score to 3 decimal places if present
      if (r.score !== undefined) {
        out.score = Math.round(r.score * 1000) / 1000;
      }

      // Include title only if not in frontmatter (avoid duplication)
      if (r.title && (!r.frontmatter || r.frontmatter.title !== r.title)) {
        out.title = r.title;
      }

      // Include frontmatter if present and non-empty
      if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
        out.frontmatter = r.frontmatter;
      }

      // Include matches for grep results
      if (r.matches) {
        out.matches = r.matches
          .map((m) => ({
            line: m.lineNumber,
            heading: m.headingPath || undefined,
            text: m.line,
            context: m.context,
          }))
          .map((m) => {
            // Remove undefined values
            Object.keys(m).forEach((k) => m[k] === undefined && delete m[k]);
            return m;
          });
      }

      // Include preview for find results
      if (r.preview) {
        out.preview = r.preview.trim();
      }

      return out;
    });

    return JSON.stringify(compactResults);
  }

  if (mode === 'files') {
    return results.map((r) => r.file).join('\n');
  }

  if (mode === 'compact') {
    return results
      .map((r) => {
        let output = `\n📄 ${r.file}`;
        if (r.score !== undefined) {
          output += ` (relevance: ${(1 - r.score).toFixed(2)})`;
        }
        if (r.matches) {
          output += `\n   ${r.matches.length} match(es)`;
          r.matches.slice(0, 3).forEach((m) => {
            if (m.headingPath) {
              output += `\n   ┌ ${m.headingPath}`;
            }
            output += `\n   │ Line ${m.lineNumber}: ${m.line.substring(0, 100)}${m.line.length > 100 ? '...' : ''}`;
          });
        } else if (r.preview) {
          output += `\n   ${r.preview}`;
        }
        return output;
      })
      .join('\n');
  }

  // Default: detailed
  return results
    .map((r) => {
      let output = `\n${'─'.repeat(60)}\n📄 ${r.file}\n${'─'.repeat(60)}`;

      if (r.frontmatter && Object.keys(r.frontmatter).length > 0) {
        output +=
          '\n' +
          Object.entries(r.frontmatter)
            .map(
              ([k, v]) =>
                `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
            )
            .join(' | ');
      }

      if (r.matches) {
        r.matches.forEach((m) => {
          if (m.headingPath) {
            output += `\n\n◆ ${m.headingPath} (lines ${m.range.start}-${m.range.end})`;
          }
          output += `\n${m.context}`;
        });
      } else if (r.preview) {
        output += `\n\n${r.preview}`;
      }

      return output;
    })
    .join('\n');
}

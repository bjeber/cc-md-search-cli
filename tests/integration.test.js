import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import {
  findMarkdownFiles,
  fuzzySearch,
  grepSearch,
  parseMarkdownFile,
  extractHeadings,
  extractSection,
  formatOutput,
} from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  test('full workflow: find, grep, section extraction', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    expect(files.length).toBeGreaterThan(0);

    // Find relevant files
    const fuzzyResults = await fuzzySearch(files, 'installation', {
      limit: 5,
      raw: false
    });

    // Grep for specific content
    const grepResults = grepSearch(files, 'Prerequisites', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    if (grepResults.length > 0) {
      // Extract section from found file
      const filePath = join(FIXTURES_DIR, grepResults[0].file);
      const parsed = parseMarkdownFile(filePath);
      const lines = parsed.body.split('\n');
      const headings = extractHeadings(lines);
      const section = extractSection(lines, headings, 'Prerequisites');

      if (section) {
        expect(section).toContain('Prerequisites');
      }
    }
  });

  test('output formats are consistent across search types', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    const grepResults = grepSearch(files, 'test', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    const fuzzyResults = await fuzzySearch(files, 'test', {
      limit: 5,
      raw: false
    });

    // Both should have file property
    if (grepResults.length > 0) {
      expect(grepResults[0].file).toBeDefined();
    }
    if (fuzzyResults.length > 0) {
      expect(fuzzyResults[0].file).toBeDefined();
    }

    // JSON output should be valid for both
    const grepJson = formatOutput(grepResults, 'json');
    const fuzzyJson = formatOutput(fuzzyResults, 'json');

    expect(() => JSON.parse(grepJson)).not.toThrow();
    expect(() => JSON.parse(fuzzyJson)).not.toThrow();
  });
});

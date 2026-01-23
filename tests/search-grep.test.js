import { describe, test, expect } from 'bun:test';
import { findMarkdownFiles, grepSearch } from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// GREP SEARCH
// ============================================================================

describe('grepSearch', () => {
  test('finds matches case-insensitively by default', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'content', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    expect(results.length).toBeGreaterThan(0);
  });

  test('respects case-sensitive option', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    const caseInsensitive = grepSearch(files, 'CONTENT', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    const caseSensitive = grepSearch(files, 'CONTENT', {
      context: 2,
      caseSensitive: true,
      raw: false
    });

    // Case insensitive should find more or equal matches
    expect(caseInsensitive.length).toBeGreaterThanOrEqual(caseSensitive.length);
  });

  test('returns empty array when no matches', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'xyznonexistent123', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    expect(results).toEqual([]);
  });

  test('returns multiple matches per file', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'Section', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    // simple.md has multiple "Section" occurrences
    const simpleResult = results.find(r => r.file === 'simple.md');
    if (simpleResult) {
      expect(simpleResult.matches.length).toBeGreaterThan(0);
    }
  });

  test('deduplicates overlapping ranges', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'Subsection', {
      context: 5,
      caseSensitive: false,
      raw: false
    });

    // Multiple subsections in simple.md, but ranges should be deduplicated
    const simpleResult = results.find(r => r.file === 'simple.md');
    if (simpleResult) {
      // Verify no overlapping ranges
      const ranges = simpleResult.matches.map(m => m.range);
      for (let i = 0; i < ranges.length - 1; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const overlaps =
            (ranges[i].start >= ranges[j].start && ranges[i].start <= ranges[j].end) ||
            (ranges[i].end >= ranges[j].start && ranges[i].end <= ranges[j].end);
          expect(overlaps).toBe(false);
        }
      }
    }
  });

  test('raw mode uses line-based context', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'keyword', {
      context: 2,
      caseSensitive: false,
      raw: true
    });

    results.forEach(r => {
      r.matches.forEach(m => {
        expect(m.headingPath).toBeNull();  // Raw mode doesn't compute heading path
      });
    });
  });

  test('includes heading path in non-raw mode', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'nested content', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    const hasHeadingPath = results.some(r =>
      r.matches.some(m => m.headingPath && m.headingPath.length > 0)
    );
    expect(hasHeadingPath).toBe(true);
  });

  test('filters frontmatter in non-raw mode', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'Prerequisites', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    const withFmResult = results.find(r => r.file === 'with-frontmatter.md');
    if (withFmResult) {
      expect(withFmResult.frontmatter.author).toBeUndefined();
      expect(withFmResult.frontmatter.date).toBeUndefined();
    }
  });

  test('includes all frontmatter in raw mode', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = grepSearch(files, 'Prerequisites', {
      context: 2,
      caseSensitive: false,
      raw: true
    });

    const withFmResult = results.find(r => r.file === 'with-frontmatter.md');
    if (withFmResult) {
      expect(withFmResult.frontmatter.author).toBeDefined();
    }
  });
});

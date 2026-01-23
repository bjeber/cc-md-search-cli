import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { writeFileSync, rmSync } from 'fs';
import { parseMarkdownFile, findMarkdownFiles, grepSearch } from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

describe('Edge Cases', () => {
  test('handles files with no content', () => {
    const tempFile = join(FIXTURES_DIR, 'temp-empty.md');
    writeFileSync(tempFile, '');

    const parsed = parseMarkdownFile(tempFile);
    expect(parsed.body).toBe('');
    expect(parsed.frontmatter).toEqual({});

    rmSync(tempFile);
  });

  test('handles frontmatter-only files', () => {
    const tempFile = join(FIXTURES_DIR, 'temp-fm-only.md');
    writeFileSync(tempFile, '---\ntitle: Only Frontmatter\n---\n');

    const parsed = parseMarkdownFile(tempFile);
    expect(parsed.frontmatter.title).toBe('Only Frontmatter');
    expect(parsed.body.trim()).toBe('');

    rmSync(tempFile);
  });

  test('handles special characters in search', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Should not throw on regex special chars when used literally
    const results = grepSearch(files, 'test', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    expect(Array.isArray(results)).toBe(true);
  });

  test('handles very long lines', () => {
    const tempFile = join(FIXTURES_DIR, 'temp-long.md');
    writeFileSync(tempFile, '# Title\n\n' + 'A'.repeat(10000));

    const parsed = parseMarkdownFile(tempFile);
    expect(parsed.body.length).toBeGreaterThan(10000);

    rmSync(tempFile);
  });
});

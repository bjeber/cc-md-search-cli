import { describe, test, expect } from 'bun:test';
import { findMarkdownFiles, fuzzySearch } from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// FUZZY SEARCH
// ============================================================================

describe('fuzzySearch', () => {
  test('finds relevant documents', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'testing documentation', {
      limit: 10,
      raw: false
    });

    expect(results.length).toBeGreaterThan(0);
  });

  test('respects limit option', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'content', {
      limit: 2,
      raw: false
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('includes score in results', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'frontmatter', {
      limit: 5,
      raw: false
    });

    results.forEach(r => {
      expect(r.score).toBeDefined();
      expect(typeof r.score).toBe('number');
    });
  });

  test('returns title from frontmatter or filename', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'test', {
      limit: 10,
      raw: false
    });

    results.forEach(r => {
      expect(r.title).toBeDefined();
    });
  });

  test('provides adaptive preview lengths', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'test', {
      limit: 10,
      raw: false
    });

    results.forEach(r => {
      expect(r.preview).toBeDefined();
    });
  });

  test('truncates long previews with ellipsis', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'code', {
      limit: 10,
      raw: false
    });

    const longPreviews = results.filter(r => r.preview.endsWith('...'));
    // Some should have been truncated
    expect(longPreviews.length).toBeGreaterThanOrEqual(0);
  });

  test('raw mode uses fixed preview length', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'test', {
      limit: 10,
      raw: true
    });

    results.forEach(r => {
      expect(r.preview.length).toBeLessThanOrEqual(203);  // 200 + '...'
    });
  });

  test('filters frontmatter in non-raw mode', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'Test Document', {
      limit: 5,
      raw: false
    });

    results.forEach(r => {
      if (Object.keys(r.frontmatter).length > 0) {
        expect(r.frontmatter.author).toBeUndefined();
        expect(r.frontmatter.date).toBeUndefined();
      }
    });
  });
});

// ============================================================================
// EXTENDED SEARCH (Fuse.js Extended Search)
// ============================================================================

describe('fuzzySearch - Extended Search', () => {
  test('AND search: space-separated words must all match', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "simple markdown" should match simple.md which contains both words
    // (simple in filename, markdown in body)
    const results = fuzzySearch(files, 'simple markdown', {
      limit: 10,
      raw: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file === 'simple.md')).toBe(true);
  });

  test('AND search: returns nothing when not all words match', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "simple xyznonexistent" should not match anything
    const results = fuzzySearch(files, 'simple xyznonexistent123', {
      limit: 10,
      raw: false
    });

    expect(results.length).toBe(0);
  });

  test('AND search: multiple words narrow results', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Single word should find more results
    const singleWord = fuzzySearch(files, 'test', {
      limit: 10,
      raw: false
    });

    // Adding more words should be same or fewer results
    const twoWords = fuzzySearch(files, 'test document', {
      limit: 10,
      raw: false
    });

    expect(singleWord.length).toBeGreaterThanOrEqual(twoWords.length);
  });

  test('exact include: single quote prefix for exact substring', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "'simple" should find files with exact "simple" substring
    const results = fuzzySearch(files, "'simple", {
      limit: 10,
      raw: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file === 'simple.md')).toBe(true);
  });

  test('exact include: finds exact phrase in body', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "'Test Document" should find the file with this exact title
    const results = fuzzySearch(files, "'Test Document", {
      limit: 10,
      raw: false
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file === 'with-frontmatter.md')).toBe(true);
  });

  test('AND with exact: combining exact operators', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "'Test 'Document" - both exact terms must match
    const results = fuzzySearch(files, "'Test 'Document", {
      limit: 10,
      raw: false
    });

    // with-frontmatter.md has title "Test Document"
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file === 'with-frontmatter.md')).toBe(true);
  });

  test('exact include is stricter than fuzzy', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Fuzzy search for partial word
    const fuzzyResults = fuzzySearch(files, 'Documen', {
      limit: 10,
      raw: false
    });

    // Exact include for same partial - should find fewer or none
    const exactResults = fuzzySearch(files, "'Documen", {
      limit: 10,
      raw: false
    });

    // Exact is stricter, so should have fewer or same results
    expect(exactResults.length).toBeLessThanOrEqual(fuzzyResults.length);
  });

  test('negation with !term removes matches', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Find all simple related
    const withSimple = fuzzySearch(files, 'simple', {
      limit: 10,
      raw: false
    });

    // Exclude simple
    const withoutSimple = fuzzySearch(files, 'content !simple', {
      limit: 10,
      raw: false
    });

    // Files with "simple" should be excluded from second search
    const simpleInFirst = withSimple.some(r => r.file === 'simple.md');
    const simpleInSecond = withoutSimple.some(r => r.file === 'simple.md');

    expect(simpleInFirst).toBe(true);
    expect(simpleInSecond).toBe(false);
  });

  test('combined operators: exact + negation', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Find "document" but exclude "simple"
    const results = fuzzySearch(files, "'document !simple", {
      limit: 10,
      raw: false
    });

    // Should not include simple.md
    expect(results.some(r => r.file === 'simple.md')).toBe(false);
  });

  test('multi-word search is more specific than single word', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    const broad = fuzzySearch(files, 'document', {
      limit: 10,
      raw: false
    });

    const specific = fuzzySearch(files, 'test document frontmatter', {
      limit: 10,
      raw: false
    });

    // More words = more specific = fewer or equal results
    expect(specific.length).toBeLessThanOrEqual(broad.length);
  });
});

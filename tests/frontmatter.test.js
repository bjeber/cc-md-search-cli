import { describe, test, expect } from 'bun:test';
import { filterFrontmatter, USEFUL_FRONTMATTER } from '../src/cli.js';

// ============================================================================
// FRONTMATTER FILTERING
// ============================================================================

describe('filterFrontmatter', () => {
  test('filters to useful keys only', () => {
    const frontmatter = {
      title: 'Test',
      description: 'Desc',
      author: 'Author',  // Should be filtered
      date: '2025-01-01',  // Should be filtered
      tags: ['a', 'b'],
      category: 'cat',
      summary: 'sum',
      keywords: 'key'
    };

    const filtered = filterFrontmatter(frontmatter);

    expect(filtered.title).toBe('Test');
    expect(filtered.description).toBe('Desc');
    expect(filtered.tags).toEqual(['a', 'b']);
    expect(filtered.category).toBe('cat');
    expect(filtered.summary).toBe('sum');
    expect(filtered.keywords).toBe('key');
    expect(filtered.author).toBeUndefined();
    expect(filtered.date).toBeUndefined();
  });

  test('returns empty object for no useful keys', () => {
    const frontmatter = {
      author: 'Author',
      date: '2025-01-01',
      custom: 'value'
    };

    const filtered = filterFrontmatter(frontmatter);
    expect(Object.keys(filtered).length).toBe(0);
  });

  test('handles empty frontmatter', () => {
    const filtered = filterFrontmatter({});
    expect(filtered).toEqual({});
  });

  test('preserves all useful keys from constant', () => {
    expect(USEFUL_FRONTMATTER).toContain('title');
    expect(USEFUL_FRONTMATTER).toContain('description');
    expect(USEFUL_FRONTMATTER).toContain('tags');
    expect(USEFUL_FRONTMATTER).toContain('category');
    expect(USEFUL_FRONTMATTER).toContain('summary');
    expect(USEFUL_FRONTMATTER).toContain('keywords');
  });
});

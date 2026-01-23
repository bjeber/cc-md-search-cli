import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import {
  parseMarkdownFile,
  extractHeadings,
  findParentHeading,
  buildHeadingPath,
} from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// PARSING
// ============================================================================

describe('parseMarkdownFile', () => {
  test('parses file with frontmatter', () => {
    const filePath = join(FIXTURES_DIR, 'with-frontmatter.md');
    const result = parseMarkdownFile(filePath);

    expect(result.filePath).toBe(filePath);
    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.description).toBe('A test document for frontmatter testing');
    expect(result.frontmatter.tags).toEqual(['test', 'markdown', 'documentation']);
    expect(result.body).toContain('# Document Title');
  });

  test('parses file without frontmatter', () => {
    const filePath = join(FIXTURES_DIR, 'simple.md');
    const result = parseMarkdownFile(filePath);

    expect(result.filePath).toBe(filePath);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toContain('# Main Title');
  });

  test('returns full content', () => {
    const filePath = join(FIXTURES_DIR, 'with-frontmatter.md');
    const result = parseMarkdownFile(filePath);

    expect(result.fullContent).toContain('---');
    expect(result.fullContent).toContain('title: Test Document');
    expect(result.fullContent).toContain('# Document Title');
  });

  test('throws error for non-existent file', () => {
    expect(() => {
      parseMarkdownFile('/non/existent/file.md');
    }).toThrow();
  });
});

// ============================================================================
// HEADING FUNCTIONS
// ============================================================================

describe('extractHeadings', () => {
  test('extracts all heading levels', () => {
    const lines = [
      '# Heading 1',
      'Some content',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '##### Heading 5',
      '###### Heading 6'
    ];
    const headings = extractHeadings(lines);

    expect(headings.length).toBe(6);
    expect(headings[0]).toEqual({ level: 1, text: 'Heading 1', line: 0 });
    expect(headings[5]).toEqual({ level: 6, text: 'Heading 6', line: 6 });
  });

  test('returns empty array for no headings', () => {
    const lines = ['Some text', 'More text', 'No headings here'];
    const headings = extractHeadings(lines);
    expect(headings).toEqual([]);
  });

  test('handles empty input', () => {
    const headings = extractHeadings([]);
    expect(headings).toEqual([]);
  });

  test('handles headings with extra spaces', () => {
    const lines = ['##   Heading with spaces   '];
    const headings = extractHeadings(lines);

    expect(headings.length).toBe(1);
    expect(headings[0].text).toBe('Heading with spaces');
  });

  test('ignores non-heading hash patterns', () => {
    const lines = [
      '# Real Heading',
      'Code: `#hashtag`',
      'Inline #not-heading',
      '    # indented is code'
    ];
    const headings = extractHeadings(lines);

    expect(headings.length).toBe(1);
    expect(headings[0].text).toBe('Real Heading');
  });
});

describe('findParentHeading', () => {
  test('finds immediate parent heading', () => {
    const headings = [
      { level: 1, text: 'Main', line: 0 },
      { level: 2, text: 'Section', line: 2 }
    ];

    const parent = findParentHeading(headings, 5);
    expect(parent.text).toBe('Section');
  });

  test('returns null when no parent', () => {
    const headings = [
      { level: 2, text: 'First Section', line: 10 }
    ];

    const parent = findParentHeading(headings, 5);
    expect(parent).toBeNull();
  });

  test('handles empty headings array', () => {
    const parent = findParentHeading([], 5);
    expect(parent).toBeNull();
  });

  test('finds closest parent not after line', () => {
    const headings = [
      { level: 1, text: 'First', line: 0 },
      { level: 2, text: 'Second', line: 5 },
      { level: 2, text: 'Third', line: 10 }
    ];

    const parent = findParentHeading(headings, 7);
    expect(parent.text).toBe('Second');
  });
});

describe('buildHeadingPath', () => {
  test('builds path from nested headings', () => {
    const headings = [
      { level: 1, text: 'Main', line: 0 },
      { level: 2, text: 'Section', line: 2 },
      { level: 3, text: 'Subsection', line: 4 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('# Main > ## Section > ### Subsection');
  });

  test('handles single heading', () => {
    const headings = [
      { level: 1, text: 'Only Heading', line: 0 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('# Only Heading');
  });

  test('handles no headings', () => {
    const path = buildHeadingPath([], 5);
    expect(path).toBe('');
  });

  test('excludes headings after line', () => {
    const headings = [
      { level: 1, text: 'Before', line: 0 },
      { level: 2, text: 'After', line: 10 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('# Before');
  });

  test('builds correct hierarchy', () => {
    const headings = [
      { level: 1, text: 'H1', line: 0 },
      { level: 2, text: 'H2', line: 2 },
      { level: 3, text: 'H3', line: 4 },
      { level: 2, text: 'H2 Again', line: 10 }
    ];

    const path = buildHeadingPath(headings, 6);
    expect(path).toBe('# H1 > ## H2 > ### H3');
  });

  test('handles heading at same level', () => {
    const headings = [
      { level: 2, text: 'Only Section', line: 0 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('## Only Section');
  });
});

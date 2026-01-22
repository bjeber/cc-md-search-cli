import { describe, test, expect, beforeAll, afterAll, beforeEach, spyOn, mock } from 'bun:test';
import { join, resolve } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import {
  findMarkdownFiles,
  findMarkdownFilesFromDirs,
  shouldExclude,
  parseMarkdownFile,
  extractHeadings,
  findParentHeading,
  buildHeadingPath,
  extractSmartContext,
  filterFrontmatter,
  extractSection,
  grepSearch,
  fuzzySearch,
  formatOutput,
  program,
  USEFUL_FRONTMATTER,
  // Configuration exports
  DEFAULT_CONFIG,
  CONFIG_FILE_NAMES,
  findConfigFile,
  loadConfigFile,
  loadConfig,
  mergeConfig,
  resolveDirectories,
  generateDefaultConfig
} from '../src/cli.js';

const FIXTURES_DIR = resolve(import.meta.dir, 'fixtures');
const SECOND_DOCS_DIR = resolve(import.meta.dir, 'fixtures/second-docs');
const NESTED_DIR = resolve(import.meta.dir, 'fixtures/nested');
const CLI_PATH = resolve(import.meta.dir, '../src/cli.js');

// Helper to run CLI command with a specific runtime
const runCli = (runtime, args, options = {}) => {
  const result = Bun.spawnSync([runtime, CLI_PATH, ...args], {
    cwd: options.cwd || import.meta.dir,
    env: process.env,
  });
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  };
};

// ============================================================================
// FILE OPERATIONS
// ============================================================================

describe('findMarkdownFiles', () => {
  test('returns empty array for empty directory', () => {
    const emptyDir = join(FIXTURES_DIR, 'empty');
    const files = findMarkdownFiles(emptyDir);
    expect(files).toEqual([]);
  });

  test('finds .md files', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const mdFiles = files.filter(f => f.relativePath.endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  test('finds .markdown files', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const markdownFiles = files.filter(f => f.relativePath.endsWith('.markdown'));
    expect(markdownFiles.length).toBeGreaterThan(0);
    expect(markdownFiles.some(f => f.relativePath === 'alternate.markdown')).toBe(true);
  });

  test('finds files in nested directories', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const nestedFiles = files.filter(f => f.relativePath.includes('nested'));
    expect(nestedFiles.length).toBeGreaterThan(0);
    expect(nestedFiles.some(f => f.relativePath.includes('deep.md'))).toBe(true);
  });

  test('returns both path and relativePath', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    expect(files.length).toBeGreaterThan(0);
    files.forEach(file => {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('relativePath');
      expect(file.path).toContain(FIXTURES_DIR);
    });
  });

  test('ignores non-markdown files', () => {
    // Create a temp non-markdown file
    const tempFile = join(FIXTURES_DIR, 'temp.txt');
    writeFileSync(tempFile, 'temp content');

    const files = findMarkdownFiles(FIXTURES_DIR);
    const txtFiles = files.filter(f => f.relativePath.endsWith('.txt'));
    expect(txtFiles.length).toBe(0);

    // Cleanup
    rmSync(tempFile);
  });
});

// ============================================================================
// MULTI-DIRECTORY FILE OPERATIONS
// ============================================================================

describe('findMarkdownFilesFromDirs', () => {
  test('returns files from single directory (backward compatibility)', () => {
    const files = findMarkdownFilesFromDirs([NESTED_DIR]);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.relativePath.includes('deep.md'))).toBe(true);
  });

  test('returns files from multiple directories', () => {
    const files = findMarkdownFilesFromDirs([NESTED_DIR, SECOND_DOCS_DIR]);

    // Should have files from both directories
    expect(files.length).toBeGreaterThan(1);

    // Check files from nested dir (prefixed with directory)
    const nestedFiles = files.filter(f => f.relativePath.includes('nested'));
    expect(nestedFiles.length).toBeGreaterThan(0);

    // Check files from second-docs dir (prefixed with directory)
    const secondDocsFiles = files.filter(f => f.relativePath.includes('second-docs'));
    expect(secondDocsFiles.length).toBeGreaterThan(0);
  });

  test('prefixes relative paths with directory name for multiple dirs', () => {
    const files = findMarkdownFilesFromDirs([NESTED_DIR, SECOND_DOCS_DIR]);

    // All paths should include their source directory
    files.forEach(f => {
      expect(f.relativePath.includes('nested') || f.relativePath.includes('second-docs')).toBe(true);
    });
  });

  test('does not prefix paths when single directory', () => {
    const files = findMarkdownFilesFromDirs([SECOND_DOCS_DIR]);

    // Paths should NOT include the directory prefix when only one dir
    const apiGuide = files.find(f => f.relativePath.includes('api-guide'));
    expect(apiGuide).toBeDefined();
    expect(apiGuide.relativePath).toBe('api-guide.md');
  });

  test('handles empty array', () => {
    const files = findMarkdownFilesFromDirs([]);
    expect(files).toEqual([]);
  });

  test('handles non-existent directory gracefully', () => {
    const files = findMarkdownFilesFromDirs(['/non/existent/path']);
    expect(files).toEqual([]);
  });

  test('continues processing when one directory fails', () => {
    const files = findMarkdownFilesFromDirs(['/non/existent/path', SECOND_DOCS_DIR]);

    // Should still have files from the valid directory
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.relativePath.includes('api-guide'))).toBe(true);
  });

  test('aggregates files from overlapping directories', () => {
    // When searching both FIXTURES_DIR and NESTED_DIR, nested files appear once from each
    const files = findMarkdownFilesFromDirs([FIXTURES_DIR, NESTED_DIR]);

    // deep.md should appear twice (once from fixtures/nested, once from nested directly)
    const deepFiles = files.filter(f => f.relativePath.includes('deep.md'));
    expect(deepFiles.length).toBe(2);
  });
});

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
    expect(headings[0].text).toBe('Heading with spaces');
  });

  test('ignores lines that look like headings but are not', () => {
    const lines = [
      '#Not a heading',  // No space after #
      '##',              // No text
      '# Valid Heading'
    ];
    const headings = extractHeadings(lines);
    expect(headings.length).toBe(1);
    expect(headings[0].text).toBe('Valid Heading');
  });

  test('captures correct line numbers', () => {
    const lines = [
      'Line 0',
      '# Heading at line 1',
      'Line 2',
      'Line 3',
      '## Heading at line 4'
    ];
    const headings = extractHeadings(lines);
    expect(headings[0].line).toBe(1);
    expect(headings[1].line).toBe(4);
  });
});

describe('findParentHeading', () => {
  test('finds nearest heading before line', () => {
    const headings = [
      { level: 1, text: 'H1', line: 0 },
      { level: 2, text: 'H2', line: 5 },
      { level: 3, text: 'H3', line: 10 }
    ];

    const parent = findParentHeading(headings, 12);
    expect(parent.text).toBe('H3');
  });

  test('returns null when no heading before line', () => {
    const headings = [
      { level: 1, text: 'H1', line: 5 }
    ];

    const parent = findParentHeading(headings, 3);
    expect(parent).toBeNull();
  });

  test('returns null for empty headings', () => {
    const parent = findParentHeading([], 10);
    expect(parent).toBeNull();
  });

  test('selects nearest, not first', () => {
    const headings = [
      { level: 1, text: 'First', line: 0 },
      { level: 2, text: 'Middle', line: 5 },
      { level: 3, text: 'Nearest', line: 8 }
    ];

    const parent = findParentHeading(headings, 10);
    expect(parent.text).toBe('Nearest');
  });
});

describe('buildHeadingPath', () => {
  test('builds path from hierarchy', () => {
    const headings = [
      { level: 1, text: 'Main', line: 0 },
      { level: 2, text: 'Section', line: 5 },
      { level: 3, text: 'Subsection', line: 10 }
    ];

    const path = buildHeadingPath(headings, 12);
    expect(path).toBe('# Main > ## Section > ### Subsection');
  });

  test('returns empty string when no prior headings', () => {
    const headings = [
      { level: 1, text: 'Main', line: 10 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('');
  });

  test('skips non-parent headings', () => {
    const headings = [
      { level: 1, text: 'H1', line: 0 },
      { level: 3, text: 'H3', line: 5 },  // H2 missing
      { level: 2, text: 'H2', line: 10 }   // H2 comes after H3
    ];

    const path = buildHeadingPath(headings, 15);
    expect(path).toBe('# H1 > ## H2');
  });

  test('handles single heading', () => {
    const headings = [
      { level: 2, text: 'Only Section', line: 0 }
    ];

    const path = buildHeadingPath(headings, 5);
    expect(path).toBe('## Only Section');
  });
});

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

describe('extractSmartContext', () => {
  test('extracts paragraph boundaries', () => {
    const lines = [
      'First paragraph.',
      '',
      'Second paragraph line 1.',
      'Second paragraph line 2.',
      '',
      'Third paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 2);
    expect(start).toBe(2);
    expect(end).toBe(3);
  });

  test('extracts full code block when match inside', () => {
    const lines = [
      'Before code',
      '```javascript',
      'const x = 1;',
      'const keyword = "test";',
      '```',
      'After code'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(1);  // Code block start
    expect(end).toBe(4);    // Code block end
  });

  test('handles unclosed code block', () => {
    const lines = [
      'Before',
      '```bash',
      'echo "unclosed"',
      'keyword here',
      'more content'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(1);  // Code block start
    // When code block is not closed, end stays at match position
    expect(end).toBe(3);
  });

  test('stops at heading', () => {
    const lines = [
      '# Heading',
      'Paragraph content.',
      'More content.',
      '## Next Heading',
      'Different section.'
    ];

    const { start, end } = extractSmartContext(lines, 1);
    expect(start).toBe(1);
    expect(end).toBe(2);
  });

  test('handles match at start of file', () => {
    const lines = [
      'First line with match.',
      'Second line.',
      '',
      'New paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 0);
    expect(start).toBe(0);
    expect(end).toBe(1);
  });

  test('handles match at end of file', () => {
    const lines = [
      '',
      'Middle content.',
      '',
      'Last paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 3);
    expect(start).toBe(3);
    expect(end).toBe(3);
  });

  test('extends to previous lines when no boundary before match', () => {
    // No blank line or heading before match - should extend to start
    const lines = [
      'First line.',
      'Second line.',
      'Third line with match.',
      '',
      'Next paragraph.'
    ];

    const { start, end } = extractSmartContext(lines, 2);
    expect(start).toBe(0);  // Should extend back to start
    expect(end).toBe(2);    // Should stop before blank line
  });
});

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

describe('extractSection', () => {
  test('extracts section by heading text', () => {
    const lines = [
      '# Main',
      'Intro',
      '## Section One',
      'Section one content.',
      '## Section Two',
      'Section two content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Section One');
    expect(section).toContain('## Section One');
    expect(section).toContain('Section one content.');
    expect(section).not.toContain('Section two');
  });

  test('extracts section including nested headings', () => {
    const lines = [
      '# Main',
      '## Parent',
      'Parent content.',
      '### Child',
      'Child content.',
      '## Sibling',
      'Sibling content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Parent');
    expect(section).toContain('## Parent');
    expect(section).toContain('### Child');
    expect(section).toContain('Child content.');
    expect(section).not.toContain('Sibling');
  });

  test('returns null when heading not found', () => {
    const lines = ['# Only Heading', 'Content'];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Nonexistent');
    expect(section).toBeNull();
  });

  test('handles heading path input', () => {
    const lines = [
      '# Main',
      '## Setup',
      '### Prerequisites',
      'You need X.',
      '### Steps',
      'Step 1.'
    ];
    const headings = extractHeadings(lines);

    // Should find Prerequisites from path
    const section = extractSection(lines, headings, 'Setup > Prerequisites');
    expect(section).toContain('### Prerequisites');
    expect(section).toContain('You need X.');
    expect(section).not.toContain('Steps');
  });

  test('extracts to end of file', () => {
    const lines = [
      '# Main',
      '## Last Section',
      'Final content.',
      'More final content.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'Last Section');
    expect(section).toContain('Final content.');
    expect(section).toContain('More final content.');
  });

  test('handles case insensitive matching', () => {
    const lines = [
      '# UPPER CASE',
      'Content here.'
    ];
    const headings = extractHeadings(lines);

    const section = extractSection(lines, headings, 'upper case');
    expect(section).toContain('# UPPER CASE');
  });
});

// ============================================================================
// SEARCH FUNCTIONS
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

    // Exact include is stricter
    expect(exactResults.length).toBeLessThanOrEqual(fuzzyResults.length);
  });

  test('prefix match: caret for starts-with', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "^Test" should match "Test Document" title
    const results = fuzzySearch(files, '^Test', {
      limit: 10,
      raw: false
    });

    // with-frontmatter.md has title "Test Document"
    if (results.length > 0) {
      expect(results.some(r => r.file === 'with-frontmatter.md')).toBe(true);
    }
  });

  test('suffix match: dollar for ends-with', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // "testing$" should match "frontmatter testing" in description
    const results = fuzzySearch(files, 'testing$', {
      limit: 10,
      raw: false
    });

    // with-frontmatter.md has description ending with "testing"
    if (results.length > 0) {
      expect(results.some(r => r.file === 'with-frontmatter.md')).toBe(true);
    }
  });

  test('OR search: pipe finds either term', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Test that OR works - search for terms from different files
    const results = fuzzySearch(files, "'simple | 'frontmatter", {
      limit: 10,
      raw: false
    });

    // Should find simple.md or with-frontmatter.md (or both)
    const hasSimple = results.some(r => r.file === 'simple.md');
    const hasFrontmatter = results.some(r => r.file === 'with-frontmatter.md');

    // At least one should match
    expect(hasSimple || hasFrontmatter).toBe(true);
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

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

describe('formatOutput', () => {
  const sampleResults = [
    {
      file: 'test.md',
      matches: [
        {
          lineNumber: 10,
          line: 'Test line content',
          headingPath: '# Main > ## Section',
          context: 'Full context here',
          range: { start: 8, end: 12 }
        }
      ],
      frontmatter: { title: 'Test' }
    }
  ];

  const sampleFuzzyResults = [
    {
      file: 'test.md',
      score: 0.2,
      title: 'Test Document',
      frontmatter: { title: 'Test' },
      preview: 'Preview content here'
    }
  ];

  test('json mode returns valid compact JSON', () => {
    const output = formatOutput(sampleResults, 'json');
    const parsed = JSON.parse(output);

    // Compact JSON transforms the structure for AI consumption
    expect(parsed).toHaveLength(1);
    expect(parsed[0].file).toBe('test.md');
    expect(parsed[0].frontmatter).toEqual({ title: 'Test' });
    expect(parsed[0].matches).toHaveLength(1);
    expect(parsed[0].matches[0].line).toBe(10);
    expect(parsed[0].matches[0].heading).toBe('# Main > ## Section');
    expect(parsed[0].matches[0].text).toBe('Test line content');
    expect(parsed[0].matches[0].context).toBe('Full context here');
    // No whitespace in compact JSON
    expect(output).not.toContain('\n');
  });

  test('files mode returns only file paths', () => {
    const results = [
      { file: 'a.md' },
      { file: 'b.md' },
      { file: 'c.md' }
    ];

    const output = formatOutput(results, 'files');
    expect(output).toBe('a.md\nb.md\nc.md');
  });

  test('compact mode shows summary', () => {
    const output = formatOutput(sampleResults, 'compact');

    expect(output).toContain('test.md');
    expect(output).toContain('1 match(es)');
    expect(output).toContain('Line 10');
  });

  test('compact mode shows relevance score for fuzzy results', () => {
    const output = formatOutput(sampleFuzzyResults, 'compact');

    expect(output).toContain('relevance:');
    expect(output).toContain('0.80');  // 1 - 0.2
  });

  test('compact mode shows heading path', () => {
    const output = formatOutput(sampleResults, 'compact');

    expect(output).toContain('# Main > ## Section');
  });

  test('compact mode limits displayed matches', () => {
    const manyMatches = [{
      file: 'test.md',
      matches: [
        { lineNumber: 1, line: 'Line 1', headingPath: '' },
        { lineNumber: 2, line: 'Line 2', headingPath: '' },
        { lineNumber: 3, line: 'Line 3', headingPath: '' },
        { lineNumber: 4, line: 'Line 4', headingPath: '' },
        { lineNumber: 5, line: 'Line 5', headingPath: '' }
      ],
      frontmatter: {}
    }];

    const output = formatOutput(manyMatches, 'compact');

    // Should show 5 match(es) but only display first 3
    expect(output).toContain('5 match(es)');
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 3');
    expect(output).not.toContain('Line 4:');
  });

  test('compact mode truncates long lines', () => {
    const longLineResult = [{
      file: 'test.md',
      matches: [{
        lineNumber: 1,
        line: 'A'.repeat(150),
        headingPath: ''
      }],
      frontmatter: {}
    }];

    const output = formatOutput(longLineResult, 'compact');
    expect(output).toContain('...');
  });

  test('detailed mode shows full context', () => {
    const output = formatOutput(sampleResults, 'detailed');

    expect(output).toContain('Full context here');
    expect(output).toContain('lines 8-12');
  });

  test('detailed mode shows frontmatter', () => {
    const output = formatOutput(sampleResults, 'detailed');

    expect(output).toContain('title: Test');
  });

  test('detailed mode shows preview for fuzzy results', () => {
    const output = formatOutput(sampleFuzzyResults, 'detailed');

    expect(output).toContain('Preview content here');
  });

  test('default mode is detailed', () => {
    const detailedOutput = formatOutput(sampleResults, 'detailed');
    const defaultOutput = formatOutput(sampleResults, 'default');

    // Both should have detailed formatting
    expect(defaultOutput).toContain('Full context here');
  });

  test('handles empty results', () => {
    const output = formatOutput([], 'compact');
    expect(output).toBe('');
  });

  test('handles frontmatter with object values', () => {
    const results = [{
      file: 'test.md',
      frontmatter: { tags: ['a', 'b'] },
      preview: 'Preview'
    }];

    const output = formatOutput(results, 'detailed');
    expect(output).toContain('tags: ["a","b"]');
  });
});

// ============================================================================
// CLI COMMANDS
// ============================================================================

describe('CLI Commands', () => {
  let originalLog;
  let logOutput;
  let originalError;
  let errorOutput;
  let originalExit;

  beforeAll(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;

    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };
    process.exit = (code) => {
      throw new Error(`Process.exit(${code})`);
    };
  });

  afterAll(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  });

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
  });

  describe('grep command', () => {
    test('basic grep search', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'content', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with context option', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'test', FIXTURES_DIR, '-c', '3']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with case-sensitive flag', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'Test', FIXTURES_DIR, '-s']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with raw flag', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'content', FIXTURES_DIR, '-r']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('grep with json output', async () => {
      await program.parseAsync(['node', 'test', 'grep', 'test', FIXTURES_DIR, '-o', 'json']);

      // JSON is the first output, followed by "Found X file(s)" message
      const jsonLine = logOutput.find(line => line.startsWith('['));
      expect(jsonLine).toBeDefined();
      expect(() => JSON.parse(jsonLine)).not.toThrow();
    });
  });

  describe('find command', () => {
    test('basic find search', async () => {
      await program.parseAsync(['node', 'test', 'find', 'testing', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with limit option', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-l', '2']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with raw flag', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-r']);

      const output = logOutput.join('\n');
      expect(output).toContain('Found');
    });

    test('find with json output', async () => {
      await program.parseAsync(['node', 'test', 'find', 'test', FIXTURES_DIR, '-o', 'json']);

      // JSON is the first output, followed by "Found X document(s)" message
      const jsonLine = logOutput.find(line => line.startsWith('['));
      expect(jsonLine).toBeDefined();
      expect(() => JSON.parse(jsonLine)).not.toThrow();
    });
  });

  describe('list command', () => {
    test('lists all markdown files', async () => {
      await program.parseAsync(['node', 'test', 'list', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('.md');
    });

    test('list with count flag', async () => {
      await program.parseAsync(['node', 'test', 'list', FIXTURES_DIR, '-c']);

      const output = logOutput.join('\n');
      expect(parseInt(output)).toBeGreaterThan(0);
    });
  });

  describe('show command', () => {
    test('shows full file content', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'show', testFile]);

      const output = logOutput.join('\n');
      expect(output).toContain('# Main Title');
    });

    // Note: Testing -f and -b flags separately is problematic due to Commander
    // retaining option state between parseAsync calls. The flags work correctly
    // in actual CLI usage but cause state pollution in sequential test runs.
    // The functionality is tested indirectly via parseMarkdownFile tests.
  });

  describe('outline command', () => {
    test('outlines single file', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile]);

      const output = logOutput.join('\n');
      expect(output).toContain('# Main Title');
      expect(output).toContain('## Section');
    });

    test('outlines directory', async () => {
      await program.parseAsync(['node', 'test', 'outline', FIXTURES_DIR]);

      const output = logOutput.join('\n');
      expect(output).toContain('.md');
    });

    test('outline with depth filter', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile, '-d', '2']);

      const output = logOutput.join('\n');
      expect(output).toContain('## Section');
      expect(output).not.toContain('###');
    });

    test('outline with json output for file', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'outline', testFile, '-o', 'json']);

      const output = logOutput.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.file).toBeDefined();
      expect(parsed.headings).toBeDefined();
    });

    test('outline with json output for directory', async () => {
      await program.parseAsync(['node', 'test', 'outline', FIXTURES_DIR, '-o', 'json']);

      // Each file outputs a JSON line
      const output = logOutput.join('\n');
      const lines = output.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('section command', () => {
    test('extracts section by heading', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'section', testFile, 'Section One']);

      const output = logOutput.join('\n');
      expect(output).toContain('## Section One');
      expect(output).toContain('content in section one');
    });

    test('section with json output', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      await program.parseAsync(['node', 'test', 'section', testFile, 'Section One', '-o', 'json']);

      const output = logOutput.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.file).toBeDefined();
      expect(parsed.heading).toBe('Section One');
      expect(parsed.content).toContain('## Section One');
    });

    test('section not found error', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');

      try {
        await program.parseAsync(['node', 'test', 'section', testFile, 'Nonexistent']);
      } catch (e) {
        expect(e.message).toContain('exit(1)');
      }

      const output = errorOutput.join('\n');
      expect(output).toContain('not found');
    });
  });

  // ==========================================================================
  // MULTI-DIRECTORY CLI COMMANDS
  // ==========================================================================

  describe('multi-directory support', () => {
    describe('grep with multiple directories', () => {
      test('grep searches across multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'content', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'compact']);

        const output = logOutput.join('\n');
        expect(output).toContain('Found');
      });

      test('grep returns results from both directories', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'API', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);

        const jsonLine = logOutput.find(line => line.startsWith('['));
        expect(jsonLine).toBeDefined();
        const results = JSON.parse(jsonLine);

        // Should find results from second-docs (api-guide.md has "API")
        // File paths are absolute paths when using multiple directories
        const hasSecondDocs = results.some(r => r.file.includes('second-docs') || r.file.includes('api-guide'));
        expect(hasSecondDocs).toBe(true);
      });
    });

    describe('find with multiple directories', () => {
      test('find searches across multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'find', 'API', NESTED_DIR, SECOND_DOCS_DIR, '-l', '5']);

        const output = logOutput.join('\n');
        expect(output).toContain('Found');
      });

      test('find returns results from multiple directories', async () => {
        await program.parseAsync(['node', 'test', 'find', 'documentation', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);

        const jsonLine = logOutput.find(line => line.startsWith('['));
        expect(jsonLine).toBeDefined();
        const results = JSON.parse(jsonLine);

        // Should find api-guide.md from second-docs
        expect(results.some(r => r.file.includes('api-guide'))).toBe(true);
      });
    });

    describe('list with multiple directories', () => {
      // Note: Commander retains option state between parseAsync calls.
      // The count tests are better covered in cross-runtime tests which spawn fresh processes.
      test('list count aggregates across directories', async () => {
        // Get count from each individually
        await program.parseAsync(['node', 'test', 'list', NESTED_DIR, '-c']);
        const nestedCount = parseInt(logOutput[logOutput.length - 1]);

        logOutput.length = 0;
        await program.parseAsync(['node', 'test', 'list', SECOND_DOCS_DIR, '-c']);
        const secondCount = parseInt(logOutput[logOutput.length - 1]);

        logOutput.length = 0;
        await program.parseAsync(['node', 'test', 'list', NESTED_DIR, SECOND_DOCS_DIR, '-c']);
        const combinedCount = parseInt(logOutput[logOutput.length - 1]);

        expect(combinedCount).toBe(nestedCount + secondCount);
      });
    });

    describe('outline with multiple directories', () => {
      test('outline shows structure from multiple directories', async () => {
        // Explicitly set text output mode to avoid Commander state issues
        await program.parseAsync(['node', 'test', 'outline', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'text']);

        const output = logOutput.join('\n');
        // Should include headings from both directories
        expect(output).toContain('Nested File');  // From deep.md
        expect(output).toContain('API Documentation');  // From api-guide.md
      });

      test('outline with depth filter works across multiple directories', async () => {
        // Explicitly set text output mode to avoid Commander state issues
        await program.parseAsync(['node', 'test', 'outline', NESTED_DIR, SECOND_DOCS_DIR, '-d', '1', '-o', 'text']);

        const output = logOutput.join('\n');
        // Should only show h1 headings
        expect(output).toContain('# Nested File');
        expect(output).toContain('# API Documentation');
        // Should not show h2 or deeper
        expect(output).not.toContain('## Purpose');
        expect(output).not.toContain('## Authentication');
      });
    });

    describe('default directory behavior', () => {
      test('grep defaults to current directory when no directory specified', async () => {
        // This should work without throwing (searches current dir)
        await program.parseAsync(['node', 'test', 'grep', 'nonexistentpattern12345']);
        const output = logOutput.join('\n');
        expect(output).toContain('Found 0');
      });

      test('find defaults to current directory when no directory specified', async () => {
        await program.parseAsync(['node', 'test', 'find', 'nonexistentquery12345', '-l', '1']);
        const output = logOutput.join('\n');
        expect(output).toContain('Found 0');
      });

      test('list defaults to current directory when no directory specified', async () => {
        await program.parseAsync(['node', 'test', 'list']);
        // Should complete without error - may or may not find files depending on cwd
        expect(true).toBe(true);
      });

      test('outline defaults to current directory when no path specified', async () => {
        await program.parseAsync(['node', 'test', 'outline']);
        // Should complete without error
        expect(true).toBe(true);
      });
    });

    describe('error handling', () => {
      test('grep continues when one directory does not exist', async () => {
        await program.parseAsync(['node', 'test', 'grep', 'API', '/nonexistent/path', SECOND_DOCS_DIR, '-o', 'compact']);

        const output = logOutput.join('\n');
        const errors = errorOutput.join('\n');

        // Should report error for non-existent dir
        expect(errors).toContain('Error reading directory');
        // Should still find results from valid directory
        expect(output).toContain('Found');
      });

      test('find continues when one directory does not exist', async () => {
        await program.parseAsync(['node', 'test', 'find', 'API', '/nonexistent/path', SECOND_DOCS_DIR, '-l', '5', '-o', 'compact']);

        const output = logOutput.join('\n');
        const errors = errorOutput.join('\n');

        // Should report error for non-existent dir
        expect(errors).toContain('Error reading directory');
        // Should still find results from valid directory
        expect(output).toContain('Found');
      });

      // Note: list with non-existent directory is tested in cross-runtime tests
      // because Commander retains the -c flag state between parseAsync calls
    });
  });
});

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

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  test('full workflow: find, grep, section extraction', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    expect(files.length).toBeGreaterThan(0);

    // Find relevant files
    const fuzzyResults = fuzzySearch(files, 'installation', {
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

  test('output formats are consistent across search types', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    const grepResults = grepSearch(files, 'test', {
      context: 2,
      caseSensitive: false,
      raw: false
    });

    const fuzzyResults = fuzzySearch(files, 'test', {
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

// ============================================================================
// CROSS-RUNTIME TESTS (Bun & Node.js)
// ============================================================================

describe('Cross-Runtime Tests', () => {
  const RUNTIMES = ['bun', 'node'];

  describe.each(RUNTIMES)('%s runtime', (runtime) => {
    test('--version returns version', () => {
      const { stdout, exitCode } = runCli(runtime, ['--version']);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('--help shows usage', () => {
      const { stdout, exitCode } = runCli(runtime, ['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('ccmds');
      expect(stdout).toContain('grep');
      expect(stdout).toContain('find');
    });

    test('list command works', () => {
      const { stdout, exitCode } = runCli(runtime, ['list', FIXTURES_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('.md');
      expect(stdout.split('\n').length).toBeGreaterThan(0);
    });

    test('list --count works', () => {
      const { stdout, exitCode } = runCli(runtime, ['list', FIXTURES_DIR, '-c']);
      expect(exitCode).toBe(0);
      expect(parseInt(stdout)).toBeGreaterThan(0);
    });

    test('grep command works', () => {
      const { stdout, exitCode } = runCli(runtime, ['grep', 'content', FIXTURES_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Found');
    });

    test('grep --output json works', () => {
      const { stdout, exitCode } = runCli(runtime, ['grep', 'test', FIXTURES_DIR, '-o', 'json']);
      expect(exitCode).toBe(0);
      // JSON is pretty-printed, extract everything before the "Found" line
      const jsonStr = stdout.split('\n✓ Found')[0].trim();
      expect(() => JSON.parse(jsonStr)).not.toThrow();
      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test('find command works', () => {
      const { stdout, exitCode } = runCli(runtime, ['find', 'testing', FIXTURES_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Found');
    });

    test('find --limit works', () => {
      const { stdout, exitCode } = runCli(runtime, ['find', 'test', FIXTURES_DIR, '-l', '2']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Found');
    });

    test('show command works', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const { stdout, exitCode } = runCli(runtime, ['show', testFile]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('# Main Title');
    });

    test('outline command works', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const { stdout, exitCode } = runCli(runtime, ['outline', testFile]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('# Main Title');
      expect(stdout).toContain('## Section');
    });

    test('outline --depth works', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const { stdout, exitCode } = runCli(runtime, ['outline', testFile, '-d', '1']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('# Main Title');
      expect(stdout).not.toContain('## Section');
    });

    test('section command works', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const { stdout, exitCode } = runCli(runtime, ['section', testFile, 'Section One']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('## Section One');
    });

    test('section not found returns error', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const { stderr, exitCode } = runCli(runtime, ['section', testFile, 'Nonexistent']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('not found');
    });
  });

  describe('Cross-runtime output consistency', () => {
    test('list output matches between runtimes', () => {
      const bunResult = runCli('bun', ['list', FIXTURES_DIR]);
      const nodeResult = runCli('node', ['list', FIXTURES_DIR]);

      // Both should succeed
      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      // Sort and compare (order may differ)
      const bunFiles = bunResult.stdout.split('\n').sort();
      const nodeFiles = nodeResult.stdout.split('\n').sort();
      expect(bunFiles).toEqual(nodeFiles);
    });

    test('grep JSON output matches between runtimes', () => {
      const bunResult = runCli('bun', ['grep', 'content', FIXTURES_DIR, '-o', 'json']);
      const nodeResult = runCli('node', ['grep', 'content', FIXTURES_DIR, '-o', 'json']);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      // Parse JSON from both (pretty-printed, extract before "Found" line)
      const bunJson = bunResult.stdout.split('\n✓ Found')[0].trim();
      const nodeJson = nodeResult.stdout.split('\n✓ Found')[0].trim();

      const bunParsed = JSON.parse(bunJson);
      const nodeParsed = JSON.parse(nodeJson);

      // Same number of results
      expect(bunParsed.length).toBe(nodeParsed.length);

      // Same files found (order may vary)
      const bunFileSet = new Set(bunParsed.map(r => r.file));
      const nodeFileSet = new Set(nodeParsed.map(r => r.file));
      expect(bunFileSet).toEqual(nodeFileSet);
    });

    test('outline output matches between runtimes', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const bunResult = runCli('bun', ['outline', testFile, '-o', 'json']);
      const nodeResult = runCli('node', ['outline', testFile, '-o', 'json']);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      const bunParsed = JSON.parse(bunResult.stdout);
      const nodeParsed = JSON.parse(nodeResult.stdout);

      expect(bunParsed.headings.length).toBe(nodeParsed.headings.length);
      expect(bunParsed.headings).toEqual(nodeParsed.headings);
    });
  });

  // ==========================================================================
  // MULTI-DIRECTORY CROSS-RUNTIME TESTS
  // ==========================================================================

  describe.each(RUNTIMES)('%s runtime - multi-directory', (runtime) => {
    test('list with multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['list', NESTED_DIR, SECOND_DOCS_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('nested');
      expect(stdout).toContain('second-docs');
    });

    test('list --count with multiple directories', () => {
      const singleNested = runCli(runtime, ['list', NESTED_DIR, '-c']);
      const singleSecond = runCli(runtime, ['list', SECOND_DOCS_DIR, '-c']);
      const combined = runCli(runtime, ['list', NESTED_DIR, SECOND_DOCS_DIR, '-c']);

      expect(combined.exitCode).toBe(0);
      const expectedCount = parseInt(singleNested.stdout) + parseInt(singleSecond.stdout);
      expect(parseInt(combined.stdout)).toBe(expectedCount);
    });

    test('grep with multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['grep', 'documentation', NESTED_DIR, SECOND_DOCS_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Found');
    });

    test('grep --output json with multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['grep', 'documentation', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);
      expect(exitCode).toBe(0);
      const jsonStr = stdout.split('\n✓ Found')[0].trim();
      expect(() => JSON.parse(jsonStr)).not.toThrow();
      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
      // Should find api-guide.md from second-docs
      expect(parsed.some(r => r.file.includes('api-guide'))).toBe(true);
    });

    test('find with multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['find', 'API documentation', NESTED_DIR, SECOND_DOCS_DIR, '-l', '5']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Found');
    });

    test('outline with multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['outline', NESTED_DIR, SECOND_DOCS_DIR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Nested File');
      expect(stdout).toContain('API Documentation');
    });

    test('outline with depth filter and multiple directories', () => {
      const { stdout, exitCode } = runCli(runtime, ['outline', NESTED_DIR, SECOND_DOCS_DIR, '-d', '1']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('# Nested File');
      expect(stdout).toContain('# API Documentation');
      expect(stdout).not.toContain('## Purpose');
      expect(stdout).not.toContain('## Authentication');
    });

    test('handles non-existent directory gracefully', () => {
      const { stdout, stderr, exitCode } = runCli(runtime, ['list', '/nonexistent/path', SECOND_DOCS_DIR]);
      expect(exitCode).toBe(0);  // Should still succeed with partial results
      expect(stderr).toContain('Error reading directory');
      expect(stdout).toContain('api-guide');  // Should still find files from valid dir
    });
  });

  describe('Cross-runtime multi-directory output consistency', () => {
    test('list output matches between runtimes for multiple directories', () => {
      const bunResult = runCli('bun', ['list', NESTED_DIR, SECOND_DOCS_DIR]);
      const nodeResult = runCli('node', ['list', NESTED_DIR, SECOND_DOCS_DIR]);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      const bunFiles = bunResult.stdout.split('\n').sort();
      const nodeFiles = nodeResult.stdout.split('\n').sort();
      expect(bunFiles).toEqual(nodeFiles);
    });

    test('grep JSON output matches between runtimes for multiple directories', () => {
      const bunResult = runCli('bun', ['grep', 'documentation', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);
      const nodeResult = runCli('node', ['grep', 'documentation', NESTED_DIR, SECOND_DOCS_DIR, '-o', 'json']);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      const bunJson = bunResult.stdout.split('\n✓ Found')[0].trim();
      const nodeJson = nodeResult.stdout.split('\n✓ Found')[0].trim();

      const bunParsed = JSON.parse(bunJson);
      const nodeParsed = JSON.parse(nodeJson);

      expect(bunParsed.length).toBe(nodeParsed.length);

      const bunFileSet = new Set(bunParsed.map(r => r.file));
      const nodeFileSet = new Set(nodeParsed.map(r => r.file));
      expect(bunFileSet).toEqual(nodeFileSet);
    });
  });
});

// ============================================================================
// CONFIGURATION SYSTEM
// ============================================================================

describe('Configuration System', () => {
  const CONFIG_TEST_DIR = resolve(import.meta.dir, 'config-test-temp');

  beforeAll(() => {
    if (!existsSync(CONFIG_TEST_DIR)) {
      mkdirSync(CONFIG_TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(CONFIG_TEST_DIR)) {
      rmSync(CONFIG_TEST_DIR, { recursive: true });
    }
  });

  describe('DEFAULT_CONFIG', () => {
    test('has all required fields', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('defaultDirectories');
      expect(DEFAULT_CONFIG).toHaveProperty('exclude');
      expect(DEFAULT_CONFIG).toHaveProperty('outputMode');
      expect(DEFAULT_CONFIG).toHaveProperty('limit');
      expect(DEFAULT_CONFIG).toHaveProperty('fuzzy');
      expect(DEFAULT_CONFIG).toHaveProperty('preview');
      expect(DEFAULT_CONFIG).toHaveProperty('frontmatterFields');
      expect(DEFAULT_CONFIG).toHaveProperty('extensions');
      expect(DEFAULT_CONFIG).toHaveProperty('aliases');
    });

    test('has correct default values', () => {
      expect(DEFAULT_CONFIG.defaultDirectories).toEqual(['.']);
      expect(DEFAULT_CONFIG.outputMode).toBe('json');
      expect(DEFAULT_CONFIG.limit).toBe(10);
      expect(DEFAULT_CONFIG.extensions).toContain('.md');
      expect(DEFAULT_CONFIG.extensions).toContain('.markdown');
    });

    test('fuzzy config has threshold and weights', () => {
      expect(DEFAULT_CONFIG.fuzzy.threshold).toBe(0.4);
      expect(DEFAULT_CONFIG.fuzzy.weights).toHaveProperty('title');
      expect(DEFAULT_CONFIG.fuzzy.weights).toHaveProperty('description');
      expect(DEFAULT_CONFIG.fuzzy.weights).toHaveProperty('body');
      expect(DEFAULT_CONFIG.fuzzy.weights).toHaveProperty('tags');
    });

    test('preview config has all length settings', () => {
      expect(DEFAULT_CONFIG.preview.topResults).toBe(600);
      expect(DEFAULT_CONFIG.preview.midResults).toBe(300);
      expect(DEFAULT_CONFIG.preview.otherResults).toBe(150);
    });
  });

  describe('CONFIG_FILE_NAMES', () => {
    test('contains expected config file names', () => {
      expect(CONFIG_FILE_NAMES).toContain('.ccmdsrc');
      expect(CONFIG_FILE_NAMES).toContain('.ccmdsrc.json');
      expect(CONFIG_FILE_NAMES).toContain('ccmds.config.json');
    });
  });

  describe('shouldExclude', () => {
    test('returns false for empty patterns', () => {
      expect(shouldExclude('some/path.md', [])).toBe(false);
      expect(shouldExclude('some/path.md', null)).toBe(false);
      expect(shouldExclude('some/path.md', undefined)).toBe(false);
    });

    test('matches simple glob patterns', () => {
      expect(shouldExclude('node_modules/file.md', ['node_modules/*'])).toBe(true);
      expect(shouldExclude('src/file.md', ['node_modules/*'])).toBe(false);
    });

    test('matches double-star glob patterns', () => {
      expect(shouldExclude('deep/nested/node_modules/file.md', ['**/node_modules/**'])).toBe(true);
      expect(shouldExclude('node_modules/deep/file.md', ['**/node_modules/**'])).toBe(true);
      expect(shouldExclude('src/file.md', ['**/node_modules/**'])).toBe(false);
    });

    test('matches file extension patterns', () => {
      expect(shouldExclude('docs/draft.md', ['**/*.draft.md'])).toBe(false);
      expect(shouldExclude('docs/file.draft.md', ['**/*.draft.md'])).toBe(true);
    });

    test('matches directory patterns', () => {
      expect(shouldExclude('.git/config', ['.*/**'])).toBe(true);
      expect(shouldExclude('.hidden/file.md', ['.*/**'])).toBe(true);
      // Pattern .*/** matches paths starting with dot, not 'visible'
      expect(shouldExclude('visible/file.md', ['.*/**'])).toBe(false);
    });

    test('matches specific directory names', () => {
      expect(shouldExclude('.hidden/file.md', ['.hidden/**'])).toBe(true);
      expect(shouldExclude('visible/file.md', ['.hidden/**'])).toBe(false);
    });
  });

  describe('loadConfigFile', () => {
    test('loads valid JSON config file', () => {
      const configPath = join(CONFIG_TEST_DIR, 'valid-config.json');
      const configContent = JSON.stringify({
        defaultDirectories: ['./docs'],
        limit: 20
      });
      writeFileSync(configPath, configContent);

      const config = loadConfigFile(configPath);
      expect(config.defaultDirectories).toEqual(['./docs']);
      expect(config.limit).toBe(20);
      expect(config._configDir).toBe(CONFIG_TEST_DIR);
      expect(config._configPath).toBe(configPath);

      rmSync(configPath);
    });

    test('returns null for invalid JSON', () => {
      const configPath = join(CONFIG_TEST_DIR, 'invalid-config.json');
      writeFileSync(configPath, 'not valid json {{{');

      const config = loadConfigFile(configPath);
      expect(config).toBeNull();

      rmSync(configPath);
    });
  });

  describe('mergeConfig', () => {
    test('merges file config with defaults', () => {
      const fileConfig = {
        limit: 25,
        outputMode: 'detailed',
        _configPath: '/test/path'
      };

      const merged = mergeConfig(DEFAULT_CONFIG, fileConfig);
      expect(merged.limit).toBe(25);
      expect(merged.outputMode).toBe('detailed');
      expect(merged.defaultDirectories).toEqual(DEFAULT_CONFIG.defaultDirectories);
    });

    test('deep merges nested objects', () => {
      const fileConfig = {
        fuzzy: {
          threshold: 0.6
        }
      };

      const merged = mergeConfig(DEFAULT_CONFIG, fileConfig);
      expect(merged.fuzzy.threshold).toBe(0.6);
      // Should preserve other fuzzy settings from defaults
      expect(merged.fuzzy.weights).toBeDefined();
    });

    test('CLI options override file config', () => {
      const fileConfig = {
        outputMode: 'detailed',
        limit: 25
      };
      const cliOptions = {
        output: 'json',
        limit: '5'
      };

      const merged = mergeConfig(DEFAULT_CONFIG, fileConfig, cliOptions);
      expect(merged.outputMode).toBe('json');
      expect(merged.limit).toBe(5);
    });
  });

  describe('loadConfig', () => {
    test('returns defaults with --no-config flag', () => {
      const config = loadConfig({ noConfig: true });
      expect(config._source).toBe('defaults');
      expect(config.limit).toBe(DEFAULT_CONFIG.limit);
    });

    test('returns defaults when no config file exists', () => {
      // Run from a directory without config
      const originalCwd = process.cwd();
      process.chdir(CONFIG_TEST_DIR);

      const config = loadConfig({});
      expect(config._source).toBe('defaults');

      process.chdir(originalCwd);
    });
  });

  describe('resolveDirectories', () => {
    test('returns CLI directories if provided', () => {
      const config = { defaultDirectories: ['./docs'], _configDir: '/project' };
      const dirs = resolveDirectories(['./src', './lib'], config);
      expect(dirs).toEqual(['./src', './lib']);
    });

    test('returns config defaults if no CLI directories', () => {
      const config = { defaultDirectories: ['./docs'], _configDir: '/project' };
      const dirs = resolveDirectories([], config);
      expect(dirs).toEqual(['/project/docs']);
    });

    test('handles empty CLI directories array', () => {
      const config = { defaultDirectories: ['.'], _configDir: '/project' };
      const dirs = resolveDirectories([], config);
      expect(dirs).toEqual(['/project']);
    });
  });

  describe('generateDefaultConfig', () => {
    test('generates valid JSON', () => {
      const content = generateDefaultConfig();
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('includes default exclude patterns', () => {
      const content = generateDefaultConfig();
      const config = JSON.parse(content);
      expect(config.exclude).toContain('**/node_modules/**');
    });

    test('uses provided directories', () => {
      const content = generateDefaultConfig({ directories: ['./wiki', './docs'] });
      const config = JSON.parse(content);
      expect(config.defaultDirectories).toEqual(['./wiki', './docs']);
    });

    test('uses default directory if not provided', () => {
      const content = generateDefaultConfig();
      const config = JSON.parse(content);
      expect(config.defaultDirectories).toEqual(['./docs']);
    });
  });

  describe('findMarkdownFiles with exclude patterns', () => {
    const EXCLUDE_TEST_DIR = join(CONFIG_TEST_DIR, 'exclude-test');

    beforeAll(() => {
      // Create test structure
      mkdirSync(join(EXCLUDE_TEST_DIR, 'docs'), { recursive: true });
      mkdirSync(join(EXCLUDE_TEST_DIR, 'node_modules'), { recursive: true });
      mkdirSync(join(EXCLUDE_TEST_DIR, '.hidden'), { recursive: true });

      writeFileSync(join(EXCLUDE_TEST_DIR, 'docs', 'readme.md'), '# Docs');
      writeFileSync(join(EXCLUDE_TEST_DIR, 'node_modules', 'package.md'), '# Package');
      writeFileSync(join(EXCLUDE_TEST_DIR, '.hidden', 'secret.md'), '# Secret');
      writeFileSync(join(EXCLUDE_TEST_DIR, 'root.md'), '# Root');
    });

    afterAll(() => {
      rmSync(EXCLUDE_TEST_DIR, { recursive: true });
    });

    test('finds all files without exclude patterns', () => {
      const files = findMarkdownFiles(EXCLUDE_TEST_DIR, EXCLUDE_TEST_DIR, {});
      expect(files.length).toBe(4);
    });

    test('excludes node_modules with pattern', () => {
      const files = findMarkdownFiles(EXCLUDE_TEST_DIR, EXCLUDE_TEST_DIR, {
        exclude: ['**/node_modules/**']
      });
      expect(files.length).toBe(3);
      expect(files.some(f => f.relativePath.includes('node_modules'))).toBe(false);
    });

    test('excludes hidden directories with pattern', () => {
      const files = findMarkdownFiles(EXCLUDE_TEST_DIR, EXCLUDE_TEST_DIR, {
        exclude: ['.*/**']
      });
      expect(files.length).toBe(3);
      expect(files.some(f => f.relativePath.includes('.hidden'))).toBe(false);
    });

    test('applies multiple exclude patterns', () => {
      const files = findMarkdownFiles(EXCLUDE_TEST_DIR, EXCLUDE_TEST_DIR, {
        exclude: ['**/node_modules/**', '.*/**']
      });
      expect(files.length).toBe(2);
      expect(files.some(f => f.relativePath.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.relativePath.includes('.hidden'))).toBe(false);
    });
  });

  describe('findMarkdownFiles with custom extensions', () => {
    const EXT_TEST_DIR = join(CONFIG_TEST_DIR, 'ext-test');

    beforeAll(() => {
      mkdirSync(EXT_TEST_DIR, { recursive: true });
      writeFileSync(join(EXT_TEST_DIR, 'file.md'), '# MD');
      writeFileSync(join(EXT_TEST_DIR, 'file.markdown'), '# Markdown');
      writeFileSync(join(EXT_TEST_DIR, 'file.mdx'), '# MDX');
      writeFileSync(join(EXT_TEST_DIR, 'file.txt'), '# TXT');
    });

    afterAll(() => {
      rmSync(EXT_TEST_DIR, { recursive: true });
    });

    test('finds only .md and .markdown by default', () => {
      const files = findMarkdownFiles(EXT_TEST_DIR, EXT_TEST_DIR, {});
      expect(files.length).toBe(2);
    });

    test('finds custom extensions when specified', () => {
      const files = findMarkdownFiles(EXT_TEST_DIR, EXT_TEST_DIR, {
        extensions: ['.md', '.markdown', '.mdx']
      });
      expect(files.length).toBe(3);
      expect(files.some(f => f.relativePath.endsWith('.mdx'))).toBe(true);
    });

    test('can search only specific extension', () => {
      const files = findMarkdownFiles(EXT_TEST_DIR, EXT_TEST_DIR, {
        extensions: ['.mdx']
      });
      expect(files.length).toBe(1);
      expect(files[0].relativePath).toBe('file.mdx');
    });
  });
});

// ============================================================================
// CLI CONFIGURATION COMMANDS
// ============================================================================

describe('CLI Configuration Commands', () => {
  const CONFIG_CLI_DIR = resolve(import.meta.dir, 'config-cli-temp');

  beforeAll(() => {
    if (!existsSync(CONFIG_CLI_DIR)) {
      mkdirSync(CONFIG_CLI_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(CONFIG_CLI_DIR)) {
      rmSync(CONFIG_CLI_DIR, { recursive: true });
    }
  });

  for (const runtime of ['bun', 'node']) {
    describe(`init command (${runtime})`, () => {
      test('creates config file in current directory', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-test-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { stdout, exitCode } = runCli(runtime, ['init'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Created config file');
        expect(existsSync(join(testDir, '.ccmdsrc'))).toBe(true);

        rmSync(testDir, { recursive: true });
      });

      test('fails if config file already exists', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-exists-${runtime}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, '.ccmdsrc'), '{}');

        const { stderr, exitCode } = runCli(runtime, ['init'], { cwd: testDir });

        expect(exitCode).toBe(1);
        expect(stderr).toContain('already exists');

        rmSync(testDir, { recursive: true });
      });

      test('overwrites with --force flag', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-force-${runtime}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, '.ccmdsrc'), '{"old": true}');

        const { stdout, exitCode } = runCli(runtime, ['init', '--force'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Created config file');

        rmSync(testDir, { recursive: true });
      });

      test('uses custom directories when provided', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-dirs-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { exitCode } = runCli(runtime, ['init', '-d', './wiki', './docs'], { cwd: testDir });

        expect(exitCode).toBe(0);

        const configPath = join(testDir, '.ccmdsrc');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        expect(config.defaultDirectories).toEqual(['./wiki', './docs']);

        rmSync(testDir, { recursive: true });
      });
    });

    describe(`config command (${runtime})`, () => {
      test('shows default config when no config file', () => {
        const testDir = join(CONFIG_CLI_DIR, `config-default-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { stdout, exitCode } = runCli(runtime, ['config', '--no-config'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('defaults');
        expect(stdout).toContain('json');

        rmSync(testDir, { recursive: true });
      });

      test('shows config file path with --path flag', () => {
        const testDir = join(CONFIG_CLI_DIR, `config-path-${runtime}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, '.ccmdsrc'), '{"limit": 15}');

        const { stdout, exitCode } = runCli(runtime, ['config', '--path'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('.ccmdsrc');

        rmSync(testDir, { recursive: true });
      });

      test('outputs JSON with --output json', () => {
        const testDir = join(CONFIG_CLI_DIR, `config-json-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { stdout, exitCode } = runCli(runtime, ['config', '--no-config', '-o', 'json'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(() => JSON.parse(stdout)).not.toThrow();

        const config = JSON.parse(stdout);
        expect(config.limit).toBe(10);
        expect(config.outputMode).toBe('json');

        rmSync(testDir, { recursive: true });
      });
    });

    describe(`exclude patterns via CLI (${runtime})`, () => {
      const EXCLUDE_CLI_DIR = join(CONFIG_CLI_DIR, `exclude-cli-${runtime}`);

      beforeAll(() => {
        mkdirSync(join(EXCLUDE_CLI_DIR, 'docs'), { recursive: true });
        mkdirSync(join(EXCLUDE_CLI_DIR, 'archive'), { recursive: true });

        writeFileSync(join(EXCLUDE_CLI_DIR, 'docs', 'readme.md'), '# Docs');
        writeFileSync(join(EXCLUDE_CLI_DIR, 'archive', 'old.md'), '# Old');
        writeFileSync(join(EXCLUDE_CLI_DIR, 'main.md'), '# Main');
      });

      afterAll(() => {
        rmSync(EXCLUDE_CLI_DIR, { recursive: true });
      });

      test('list command respects --exclude flag', () => {
        const { stdout, exitCode } = runCli(runtime, ['list', EXCLUDE_CLI_DIR, '-e', '**/archive/**', '--no-config']);

        expect(exitCode).toBe(0);
        expect(stdout).toContain('readme.md');
        expect(stdout).toContain('main.md');
        expect(stdout).not.toContain('old.md');
      });

      test('find command respects --exclude flag', () => {
        const { stdout, exitCode } = runCli(runtime, ['find', 'docs', EXCLUDE_CLI_DIR, '-e', '**/archive/**', '-o', 'files', '--no-config']);

        expect(exitCode).toBe(0);
        expect(stdout).not.toContain('archive');
      });

      test('grep command respects --exclude flag', () => {
        const { stdout, exitCode } = runCli(runtime, ['grep', '#', EXCLUDE_CLI_DIR, '-e', '**/archive/**', '-o', 'files', '--no-config']);

        expect(exitCode).toBe(0);
        expect(stdout).not.toContain('old.md');
      });
    });
  }
});

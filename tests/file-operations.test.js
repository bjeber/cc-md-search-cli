import { describe, test, expect, spyOn } from 'bun:test';
import { join } from 'path';
import { writeFileSync, rmSync } from 'fs';
import {
  findMarkdownFiles,
  findMarkdownFilesFromDirs,
} from '../src/cli.js';
import { FIXTURES_DIR, NESTED_DIR, SECOND_DOCS_DIR } from './helpers/index.js';

// ============================================================================
// FILE OPERATIONS
// ============================================================================

describe('findMarkdownFiles', () => {
  test('returns empty array for empty directory', () => {
    const emptyDir = join(FIXTURES_DIR, 'empty');
    const files = findMarkdownFiles(emptyDir);
    expect(files).toEqual([]);
  });

  test('finds markdown files in directory', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.relativePath.endsWith('.md') || f.relativePath.endsWith('.markdown'))).toBe(true);
  });

  test('includes relative path', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const simpleFile = files.find(f => f.relativePath === 'simple.md');
    expect(simpleFile).toBeDefined();
  });

  test('finds nested files', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const nestedFile = files.find(f => f.relativePath.includes('nested'));
    expect(nestedFile).toBeDefined();
  });

  test('excludes non-markdown files', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const nonMd = files.find(f => !f.relativePath.endsWith('.md') && !f.relativePath.endsWith('.markdown'));
    expect(nonMd).toBeUndefined();
  });

  test('finds .markdown extension', () => {
    // Create a temp .markdown file
    const tempFile = join(FIXTURES_DIR, 'temp-test.markdown');
    writeFileSync(tempFile, '# Test Markdown');

    const files = findMarkdownFiles(FIXTURES_DIR);
    const markdownFile = files.find(f => f.relativePath === 'temp-test.markdown');
    expect(markdownFile).toBeDefined();

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
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const files = findMarkdownFilesFromDirs(['/non/existent/path']);
    expect(files).toEqual([]);
    spy.mockRestore();
  });

  test('continues processing when one directory fails', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const files = findMarkdownFilesFromDirs(['/non/existent/path', SECOND_DOCS_DIR]);

    // Should still have files from the valid directory
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.relativePath.includes('api-guide'))).toBe(true);
    spy.mockRestore();
  });

  test('aggregates files from overlapping directories', () => {
    // When searching both FIXTURES_DIR and NESTED_DIR, nested files appear once from each
    const files = findMarkdownFilesFromDirs([FIXTURES_DIR, NESTED_DIR]);

    // deep.md should appear twice (once from fixtures/nested, once from nested directly)
    const deepFiles = files.filter(f => f.relativePath.includes('deep.md'));
    expect(deepFiles.length).toBe(2);
  });
});

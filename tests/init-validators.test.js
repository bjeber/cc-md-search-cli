import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import {
  expandTilde,
  validateDirectoryPath,
  directoryExists,
  validateGlobPattern,
  validateNumberInRange,
  validateFuzzyThreshold,
  validateDirectoryName,
  validateExtensions,
  parseExtensions,
} from '../src/init/validators.js';

// ============================================================================
// VALIDATOR UNIT TESTS
// ============================================================================

describe('Init Validators', () => {
  const TEST_DIR = resolve(import.meta.dir, 'validators-temp');

  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Create a test file (not directory)
    writeFileSync(join(TEST_DIR, 'testfile.txt'), 'test');
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('expandTilde', () => {
    test('expands ~ to home directory', () => {
      const result = expandTilde('~/docs');
      expect(result).toBe(join(homedir(), 'docs'));
    });

    test('expands standalone ~', () => {
      const result = expandTilde('~');
      expect(result).toBe(homedir());
    });

    test('does not expand ~ in middle of path', () => {
      const result = expandTilde('/path/to/~user');
      expect(result).toBe('/path/to/~user');
    });

    test('returns path unchanged if no tilde', () => {
      const result = expandTilde('./docs');
      expect(result).toBe('./docs');
    });
  });

  describe('validateDirectoryPath', () => {
    test('returns true for existing directory', () => {
      const result = validateDirectoryPath(TEST_DIR);
      expect(result).toBe(true);
    });

    test('returns true for non-existent path (will offer to create)', () => {
      const result = validateDirectoryPath(join(TEST_DIR, 'nonexistent'));
      expect(result).toBe(true);
    });

    test('returns error for empty input', () => {
      expect(validateDirectoryPath('')).toBe('Please enter a directory path');
      expect(validateDirectoryPath('   ')).toBe('Please enter a directory path');
    });

    test('returns error for path that is a file', () => {
      const filePath = join(TEST_DIR, 'testfile.txt');
      const result = validateDirectoryPath(filePath);
      expect(result).toContain('not a directory');
    });

    test('handles paths with spaces', () => {
      const result = validateDirectoryPath('./path with spaces');
      expect(result).toBe(true);
    });
  });

  describe('directoryExists', () => {
    test('returns true for existing directory', () => {
      expect(directoryExists(TEST_DIR)).toBe(true);
    });

    test('returns false for non-existent path', () => {
      expect(directoryExists(join(TEST_DIR, 'nonexistent'))).toBe(false);
    });

    test('returns false for file (not directory)', () => {
      expect(directoryExists(join(TEST_DIR, 'testfile.txt'))).toBe(false);
    });

    test('handles tilde expansion', () => {
      expect(directoryExists('~')).toBe(true);
    });
  });

  describe('validateGlobPattern', () => {
    test('returns true for valid patterns', () => {
      expect(validateGlobPattern('**/*.md')).toBe(true);
      expect(validateGlobPattern('**/node_modules/**')).toBe(true);
      expect(validateGlobPattern('*.{md,txt}')).toBe(true);
      expect(validateGlobPattern('[abc].md')).toBe(true);
    });

    test('returns error for empty input', () => {
      expect(validateGlobPattern('')).toBe('Please enter a glob pattern');
    });

    test('returns error for unbalanced braces', () => {
      expect(validateGlobPattern('*.{md,txt')).toBe('Unbalanced braces in pattern');
      expect(validateGlobPattern('*.md,txt}')).toBe('Unbalanced braces in pattern');
    });

    test('returns error for unbalanced brackets', () => {
      expect(validateGlobPattern('[abc.md')).toBe('Unbalanced brackets in pattern');
      expect(validateGlobPattern('abc].md')).toBe('Unbalanced brackets in pattern');
    });
  });

  describe('validateNumberInRange', () => {
    test('returns true for valid numbers in range', () => {
      const validator = validateNumberInRange(1, 100);
      expect(validator('10')).toBe(true);
      expect(validator('1')).toBe(true);
      expect(validator('100')).toBe(true);
    });

    test('returns error for numbers outside range', () => {
      const validator = validateNumberInRange(1, 100);
      expect(validator('0')).toContain('between 1 and 100');
      expect(validator('101')).toContain('between 1 and 100');
    });

    test('returns error for non-numbers', () => {
      const validator = validateNumberInRange(1, 100);
      expect(validator('abc')).toBe('Please enter a valid number');
    });

    test('returns error for non-integers', () => {
      const validator = validateNumberInRange(1, 100);
      expect(validator('10.5')).toBe('Please enter a whole number');
    });
  });

  describe('validateFuzzyThreshold', () => {
    test('returns true for valid thresholds', () => {
      expect(validateFuzzyThreshold('0')).toBe(true);
      expect(validateFuzzyThreshold('0.4')).toBe(true);
      expect(validateFuzzyThreshold('1')).toBe(true);
    });

    test('returns error for out of range values', () => {
      expect(validateFuzzyThreshold('-0.1')).toContain('between 0 and 1');
      expect(validateFuzzyThreshold('1.1')).toContain('between 0 and 1');
    });

    test('returns error for non-numbers', () => {
      expect(validateFuzzyThreshold('abc')).toBe('Please enter a valid number');
    });
  });

  describe('validateDirectoryName', () => {
    test('returns true for valid names', () => {
      expect(validateDirectoryName('api')).toBe(true);
      expect(validateDirectoryName('my-docs')).toBe(true);
      expect(validateDirectoryName('docs_v2')).toBe(true);
      expect(validateDirectoryName('API123')).toBe(true);
    });

    test('returns error for empty input', () => {
      expect(validateDirectoryName('')).toBe('Please enter a name');
    });

    test('returns error for invalid characters', () => {
      expect(validateDirectoryName('my docs')).toContain('only contain');
      expect(validateDirectoryName('docs/api')).toContain('only contain');
      expect(validateDirectoryName('docs.v2')).toContain('only contain');
    });

    test('returns error for too long names', () => {
      const longName = 'a'.repeat(51);
      expect(validateDirectoryName(longName)).toContain('50 characters');
    });
  });

  describe('validateExtensions', () => {
    test('returns true for valid extensions', () => {
      expect(validateExtensions('.md')).toBe(true);
      expect(validateExtensions('.md, .markdown')).toBe(true);
      expect(validateExtensions('.md,.txt,.mdx')).toBe(true);
    });

    test('returns error for empty input', () => {
      expect(validateExtensions('')).toBe('Please enter at least one extension');
    });

    test('returns error for extensions without dot', () => {
      expect(validateExtensions('md')).toContain('must start with a dot');
    });

    test('returns error for invalid extension format', () => {
      expect(validateExtensions('.md-x')).toContain('Invalid extension format');
    });
  });

  describe('parseExtensions', () => {
    test('parses comma-separated extensions', () => {
      expect(parseExtensions('.md, .markdown')).toEqual(['.md', '.markdown']);
    });

    test('handles no spaces', () => {
      expect(parseExtensions('.md,.txt,.mdx')).toEqual(['.md', '.txt', '.mdx']);
    });

    test('filters empty entries', () => {
      expect(parseExtensions('.md,,.txt')).toEqual(['.md', '.txt']);
    });
  });
});

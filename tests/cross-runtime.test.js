import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { FIXTURES_DIR, NESTED_DIR, SECOND_DOCS_DIR, runCli } from './helpers/index.js';

// ============================================================================
// RUNTIME TESTS (Bun only - Node.js not supported due to bun:sqlite)
// ============================================================================

describe('Runtime Tests', () => {
  // Node.js is not supported because we use bun:sqlite for persistence
  const RUNTIMES = ['bun'];

  describe.each(RUNTIMES)('%s runtime', (runtime) => {
    test('--version returns version', () => {
      const { stdout, exitCode } = runCli(runtime, ['--version']);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^cc-md-search-cli v\d+\.\d+\.\d+/);
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

  // Note: Cross-runtime consistency tests removed because Node.js is not supported
  // (bun:sqlite is Bun-specific)
});

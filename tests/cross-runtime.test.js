import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { FIXTURES_DIR, NESTED_DIR, SECOND_DOCS_DIR, runCli } from './helpers/index.js';

// ============================================================================
// CROSS-RUNTIME TESTS (Bun & Node.js)
// ============================================================================

describe('Cross-Runtime Tests', () => {
  const RUNTIMES = ['bun', 'node'];

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

      // Same files found
      const bunFileSet = new Set(bunParsed.map(r => r.file));
      const nodeFileSet = new Set(nodeParsed.map(r => r.file));
      expect(bunFileSet).toEqual(nodeFileSet);
    });

    test('find JSON output matches between runtimes', () => {
      const bunResult = runCli('bun', ['find', 'test', FIXTURES_DIR, '-o', 'json']);
      const nodeResult = runCli('node', ['find', 'test', FIXTURES_DIR, '-o', 'json']);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      const bunJson = bunResult.stdout.split('\n✓ Found')[0].trim();
      const nodeJson = nodeResult.stdout.split('\n✓ Found')[0].trim();

      const bunParsed = JSON.parse(bunJson);
      const nodeParsed = JSON.parse(nodeJson);

      // Same files found (order may differ due to scoring)
      const bunFileSet = new Set(bunParsed.map(r => r.file));
      const nodeFileSet = new Set(nodeParsed.map(r => r.file));
      expect(bunFileSet).toEqual(nodeFileSet);
    });

    test('outline JSON output matches between runtimes', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const bunResult = runCli('bun', ['outline', testFile, '-o', 'json']);
      const nodeResult = runCli('node', ['outline', testFile, '-o', 'json']);

      expect(bunResult.exitCode).toBe(0);
      expect(nodeResult.exitCode).toBe(0);

      const bunParsed = JSON.parse(bunResult.stdout);
      const nodeParsed = JSON.parse(nodeResult.stdout);

      expect(bunParsed.file).toBe(nodeParsed.file);
      expect(bunParsed.headings.length).toBe(nodeParsed.headings.length);
    });

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

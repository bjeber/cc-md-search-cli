import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { join, resolve } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { runCli } from './helpers/index.js';

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

  // Note: Node.js is not supported because we use bun:sqlite for persistence
  for (const runtime of ['bun']) {
    describe(`init command (${runtime})`, () => {
      // Note: Tests run in non-TTY mode, so interactive mode is skipped automatically.
      // We also explicitly use --no-interactive for clarity.

      test('creates config file in current directory (non-interactive)', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-test-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { stdout, exitCode } = runCli(runtime, ['init', '--no-interactive'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Created config file');
        expect(existsSync(join(testDir, '.ccmdsrc'))).toBe(true);

        rmSync(testDir, { recursive: true });
      });

      test('fails if config file already exists', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-exists-${runtime}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, '.ccmdsrc'), '{}');

        const { stderr, exitCode } = runCli(runtime, ['init', '--no-interactive'], { cwd: testDir });

        expect(exitCode).toBe(1);
        expect(stderr).toContain('already exists');

        rmSync(testDir, { recursive: true });
      });

      test('overwrites with --force flag', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-force-${runtime}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, '.ccmdsrc'), '{"old": true}');

        const { stdout, exitCode } = runCli(runtime, ['init', '--force', '--no-interactive'], { cwd: testDir });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Created config file');

        rmSync(testDir, { recursive: true });
      });

      test('uses custom directories when provided', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-dirs-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        const { exitCode } = runCli(runtime, ['init', '-d', './wiki', './docs', '--no-interactive'], { cwd: testDir });

        expect(exitCode).toBe(0);

        const configPath = join(testDir, '.ccmdsrc');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        expect(config.documentDirectories).toEqual(['./wiki', './docs']);

        rmSync(testDir, { recursive: true });
      });

      test('generates valid JSON config', () => {
        const testDir = join(CONFIG_CLI_DIR, `init-json-${runtime}`);
        mkdirSync(testDir, { recursive: true });

        runCli(runtime, ['init', '--no-interactive'], { cwd: testDir });

        const configPath = join(testDir, '.ccmdsrc');
        const content = readFileSync(configPath, 'utf-8');

        // Should be valid JSON
        expect(() => JSON.parse(content)).not.toThrow();

        // Should have required fields
        const config = JSON.parse(content);
        expect(config.documentDirectories).toBeDefined();
        expect(config.exclude).toBeDefined();

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

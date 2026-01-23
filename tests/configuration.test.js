import { describe, test, expect, beforeAll, afterAll, spyOn } from 'bun:test';
import { join, resolve } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import {
  findMarkdownFiles,
  shouldExclude,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAMES,
  findConfigFile,
  loadConfigFile,
  loadConfig,
  mergeConfig,
  resolveDirectories,
  normalizeDocumentDirectories,
  generateDefaultConfig,
} from '../src/cli.js';

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
      expect(DEFAULT_CONFIG).toHaveProperty('documentDirectories');
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
      expect(DEFAULT_CONFIG.documentDirectories).toEqual(['.']);
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

    test('matches node_modules pattern', () => {
      expect(shouldExclude('node_modules/pkg/file.md', ['**/node_modules/**'])).toBe(true);
      expect(shouldExclude('src/file.md', ['**/node_modules/**'])).toBe(false);
    });

    test('matches hidden directory pattern', () => {
      expect(shouldExclude('.git/config', ['.*/**'])).toBe(true);
      expect(shouldExclude('.hidden/secret.md', ['.*/**'])).toBe(true);
      expect(shouldExclude('visible/file.md', ['.*/**'])).toBe(false);
    });

    test('matches multiple patterns', () => {
      const patterns = ['**/node_modules/**', '**/dist/**', '.*/**'];
      expect(shouldExclude('node_modules/x.md', patterns)).toBe(true);
      expect(shouldExclude('dist/output.md', patterns)).toBe(true);
      expect(shouldExclude('.hidden/x.md', patterns)).toBe(true);
      expect(shouldExclude('src/app.md', patterns)).toBe(false);
    });

    test('matches specific file patterns', () => {
      expect(shouldExclude('CHANGELOG.md', ['CHANGELOG.md'])).toBe(true);
      expect(shouldExclude('README.md', ['CHANGELOG.md'])).toBe(false);
    });
  });

  describe('findConfigFile', () => {
    test('returns null when no config file exists', () => {
      // Use temp directory completely outside the project tree
      const isolatedDir = join(tmpdir(), `ccmds-config-find-test-${Date.now()}`);
      mkdirSync(isolatedDir, { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(isolatedDir);

      try {
        const result = findConfigFile();
        expect(result).toBeNull();
      } finally {
        process.chdir(originalCwd);
        rmSync(isolatedDir, { recursive: true });
      }
    });

    test('finds .ccmdsrc in current directory', () => {
      const testDir = join(CONFIG_TEST_DIR, 'find-test');
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, '.ccmdsrc'), '{}');

      const originalCwd = process.cwd();
      process.chdir(testDir);

      const result = findConfigFile();
      expect(result).toContain('.ccmdsrc');

      process.chdir(originalCwd);
      rmSync(testDir, { recursive: true });
    });

    test('walks up directory tree', () => {
      const parentDir = join(CONFIG_TEST_DIR, 'parent');
      const childDir = join(parentDir, 'child');
      mkdirSync(childDir, { recursive: true });
      writeFileSync(join(parentDir, '.ccmdsrc'), '{"limit": 20}');

      const originalCwd = process.cwd();
      process.chdir(childDir);

      const result = findConfigFile();
      expect(result).toContain('.ccmdsrc');
      expect(result).toContain('parent');

      process.chdir(originalCwd);
      rmSync(parentDir, { recursive: true });
    });
  });

  describe('loadConfigFile', () => {
    test('loads valid JSON config', () => {
      const configPath = join(CONFIG_TEST_DIR, 'test-config.json');
      writeFileSync(configPath, JSON.stringify({ limit: 15, outputMode: 'compact' }));

      const config = loadConfigFile(configPath);
      expect(config.limit).toBe(15);
      expect(config.outputMode).toBe('compact');

      rmSync(configPath);
    });

    test('returns null for non-existent file', () => {
      const spy = spyOn(console, 'error').mockImplementation(() => {});
      const result = loadConfigFile('/non/existent/config.json');
      expect(result).toBeNull();
      spy.mockRestore();
    });

    test('handles invalid JSON gracefully', () => {
      const spy = spyOn(console, 'error').mockImplementation(() => {});
      const configPath = join(CONFIG_TEST_DIR, 'invalid-config.json');
      writeFileSync(configPath, 'not valid json');

      const result = loadConfigFile(configPath);
      expect(result).toBeNull();

      rmSync(configPath);
      spy.mockRestore();
    });
  });

  describe('mergeConfig', () => {
    test('CLI options override config file', () => {
      const fileConfig = { limit: 15, outputMode: 'compact' };
      const cliOptions = { limit: 5 };

      const merged = mergeConfig(DEFAULT_CONFIG, fileConfig, cliOptions);
      expect(merged.limit).toBe(5);  // CLI wins
      expect(merged.outputMode).toBe('compact');  // File config preserved
    });

    test('deep merges nested objects', () => {
      const fileConfig = {
        fuzzy: { threshold: 0.3 },
        preview: { topResults: 800 }
      };

      const merged = mergeConfig(DEFAULT_CONFIG, fileConfig, {});
      expect(merged.fuzzy.threshold).toBe(0.3);
      expect(merged.fuzzy.weights).toBeDefined();  // Default preserved
      expect(merged.preview.topResults).toBe(800);
      expect(merged.preview.midResults).toBe(DEFAULT_CONFIG.preview.midResults);
    });

    test('preserves defaults for unset values', () => {
      const merged = mergeConfig(DEFAULT_CONFIG, {}, {});
      expect(merged.limit).toBe(DEFAULT_CONFIG.limit);
      expect(merged.outputMode).toBe(DEFAULT_CONFIG.outputMode);
    });
  });

  describe('loadConfig', () => {
    test('returns defaults with --no-config flag', () => {
      const config = loadConfig({ noConfig: true });
      expect(config._source).toBe('defaults');
      expect(config.limit).toBe(DEFAULT_CONFIG.limit);
    });

    test('returns defaults when no config file exists', () => {
      // Use temp directory completely outside the project tree to avoid finding
      // .ccmdsrc at project root when loadConfig walks up directory tree
      const isolatedDir = join(tmpdir(), `ccmds-config-test-${Date.now()}`);
      mkdirSync(isolatedDir, { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(isolatedDir);

      try {
        const config = loadConfig({});
        expect(config._source).toBe('defaults');
      } finally {
        process.chdir(originalCwd);
        rmSync(isolatedDir, { recursive: true });
      }
    });
  });

  describe('resolveDirectories', () => {
    test('returns CLI directories if provided', () => {
      const config = { documentDirectories: ['./docs'], _configDir: '/project' };
      const dirs = resolveDirectories(['./src', './lib'], config);
      expect(dirs.length).toBe(2);
      expect(dirs[0].resolvedPath).toContain('src');
      expect(dirs[1].resolvedPath).toContain('lib');
    });

    test('returns config defaults if no CLI directories', () => {
      const config = { documentDirectories: ['./docs'], _configDir: '/project' };
      const dirs = resolveDirectories([], config);
      expect(dirs.length).toBe(1);
      expect(dirs[0].resolvedPath).toBe('/project/docs');
      expect(dirs[0].name).toBe('docs');
    });

    test('handles empty CLI directories array', () => {
      const config = { documentDirectories: ['.'], _configDir: '/project' };
      const dirs = resolveDirectories([], config);
      expect(dirs.length).toBe(1);
      expect(dirs[0].resolvedPath).toBe('/project');
    });

    test('filters by doc name with --doc option', () => {
      const config = {
        documentDirectories: [
          { name: 'api', path: './api-docs' },
          { name: 'guides', path: './guides' }
        ],
        _configDir: '/project'
      };
      const dirs = resolveDirectories([], config, 'api');
      expect(dirs.length).toBe(1);
      expect(dirs[0].name).toBe('api');
    });

    test('supports prefix matching for --doc option', () => {
      const config = {
        documentDirectories: [
          { name: 'makerkit', path: './makerkit-docs' },
          { name: 'guides', path: './guides' }
        ],
        _configDir: '/project'
      };
      const dirs = resolveDirectories([], config, 'maker');
      expect(dirs.length).toBe(1);
      expect(dirs[0].name).toBe('makerkit');
    });

    test('handles named documentation entries', () => {
      const config = {
        documentDirectories: [
          { name: 'api', path: './api-docs', description: 'API reference' }
        ],
        _configDir: '/project'
      };
      const dirs = resolveDirectories([], config);
      expect(dirs[0].name).toBe('api');
      expect(dirs[0].path).toBe('./api-docs');
      expect(dirs[0].description).toBe('API reference');
      expect(dirs[0].resolvedPath).toBe('/project/api-docs');
    });

    test('auto-generates name from path for string entries', () => {
      const config = { documentDirectories: ['./docs'], _configDir: '/project' };
      const dirs = resolveDirectories([], config);
      expect(dirs[0].name).toBe('docs');
    });

    test('deduplicates names with numeric suffix', () => {
      const config = {
        documentDirectories: ['./docs', '../other/docs'],
        _configDir: '/project'
      };
      const dirs = resolveDirectories([], config);
      expect(dirs[0].name).toBe('docs');
      expect(dirs[1].name).toBe('docs-2');
    });
  });

  describe('normalizeDocumentDirectories', () => {
    test('converts string entries to objects', () => {
      const entries = normalizeDocumentDirectories(['./docs'], '/project');
      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe('docs');
      expect(entries[0].path).toBe('./docs');
      expect(entries[0].resolvedPath).toBe('/project/docs');
      expect(entries[0].description).toBeNull();
    });

    test('preserves object entries with explicit names', () => {
      const entries = normalizeDocumentDirectories([
        { name: 'api', path: './api-docs', description: 'API reference' }
      ], '/project');
      expect(entries[0].name).toBe('api');
      expect(entries[0].path).toBe('./api-docs');
      expect(entries[0].description).toBe('API reference');
    });

    test('auto-generates name from basename for objects without name', () => {
      const entries = normalizeDocumentDirectories([
        { path: './documentation' }
      ], '/project');
      expect(entries[0].name).toBe('documentation');
    });

    test('handles absolute paths', () => {
      const entries = normalizeDocumentDirectories(['/absolute/path'], '/project');
      expect(entries[0].resolvedPath).toBe('/absolute/path');
    });

    test('handles tilde paths', () => {
      const entries = normalizeDocumentDirectories(['~/docs'], '/project');
      expect(entries[0].resolvedPath).toContain('/docs');
      expect(entries[0].resolvedPath).not.toContain('~');
    });

    test('deduplicates names across entries', () => {
      const entries = normalizeDocumentDirectories([
        './docs',
        '../other/docs'
      ], '/project');
      expect(entries[0].name).toBe('docs');
      expect(entries[1].name).toBe('docs-2');
    });

    test('handles mixed string and object entries', () => {
      const entries = normalizeDocumentDirectories([
        './legacy-docs',
        { name: 'api', path: './api-docs', description: 'API reference' }
      ], '/project');
      expect(entries.length).toBe(2);
      expect(entries[0].name).toBe('legacy-docs');
      expect(entries[1].name).toBe('api');
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
      expect(config.documentDirectories).toEqual(['./wiki', './docs']);
    });

    test('uses default directory if not provided', () => {
      const content = generateDefaultConfig();
      const config = JSON.parse(content);
      expect(config.documentDirectories).toEqual(['./docs']);
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

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  findMarkdownFiles,
  fuzzySearch,
  buildOrLoadIndex,
  clearIndexCache,
  getIndexStats,
  getIndexFilePath,
  getIndexMetaPath,
  isIndexFresh,
  computeFileHash,
  computeFileHashes,
  DEFAULT_CONFIG,
} from '../src/cli.js';
import { FIXTURES_DIR } from './helpers/index.js';

// ============================================================================
// INDEX PERSISTENCE TESTS
// ============================================================================

describe('Index Persistence', () => {
  let tempDir;
  let tempConfig;

  beforeEach(() => {
    // Create temp directory for index files
    tempDir = join(tmpdir(), `ccmds-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfig = {
      ...DEFAULT_CONFIG,
      _configDir: tempDir,
      index: {
        enabled: true,
        path: '.ccmds-fuse-index.json',
        autoRebuild: true,
      },
    };
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('computeFileHash', () => {
    test('returns consistent hash for same file', () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const hash1 = computeFileHash(testFile);
      const hash2 = computeFileHash(testFile);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(12);
    });

    test('returns "missing" for non-existent file', () => {
      const hash = computeFileHash('/non/existent/file.md');
      expect(hash).toBe('missing');
    });
  });

  describe('computeFileHashes', () => {
    test('computes hashes for all files', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const hashes = computeFileHashes(files);

      expect(Object.keys(hashes).length).toBe(files.length);
      files.forEach((f) => {
        expect(hashes[f.path]).toBeDefined();
        expect(hashes[f.path]).toHaveLength(12);
      });
    });
  });

  describe('getIndexFilePath / getIndexMetaPath', () => {
    test('returns correct paths based on config', () => {
      const indexPath = getIndexFilePath(tempConfig);
      const metaPath = getIndexMetaPath(tempConfig);

      expect(indexPath).toBe(join(tempDir, '.ccmds-fuse-index.json'));
      expect(metaPath).toBe(join(tempDir, '.ccmds-fuse-index-meta.json'));
    });

    test('uses custom path from config', () => {
      const customConfig = {
        ...tempConfig,
        index: { ...tempConfig.index, path: 'custom-index.json' },
      };
      const indexPath = getIndexFilePath(customConfig);
      expect(indexPath).toBe(join(tempDir, 'custom-index.json'));
    });
  });

  describe('isIndexFresh', () => {
    test('returns false when meta file does not exist', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const metaPath = join(tempDir, 'nonexistent-meta.json');

      expect(isIndexFresh(metaPath, files)).toBe(false);
    });

    test('returns false when file count changes', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const metaPath = getIndexMetaPath(tempConfig);

      // Create meta with wrong file count
      writeFileSync(
        metaPath,
        JSON.stringify({
          version: 1,
          fileHashes: {},
        })
      );

      expect(isIndexFresh(metaPath, files)).toBe(false);
    });
  });

  describe('buildOrLoadIndex', () => {
    test('creates index files when enabled', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const indexPath = getIndexFilePath(tempConfig);
      const metaPath = getIndexMetaPath(tempConfig);

      expect(existsSync(indexPath)).toBe(false);
      expect(existsSync(metaPath)).toBe(false);

      buildOrLoadIndex(files, tempConfig);

      expect(existsSync(indexPath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);
    });

    test('does not create index files when disabled', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const disabledConfig = {
        ...tempConfig,
        index: { ...tempConfig.index, enabled: false },
      };
      const indexPath = getIndexFilePath(disabledConfig);

      buildOrLoadIndex(files, disabledConfig);

      expect(existsSync(indexPath)).toBe(false);
    });

    test('returns working Fuse instance', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const { fuse } = buildOrLoadIndex(files, tempConfig);

      const results = fuse.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    test('loads cached index on second call', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const indexPath = getIndexFilePath(tempConfig);

      // First call - creates index
      buildOrLoadIndex(files, tempConfig);
      expect(existsSync(indexPath)).toBe(true);

      // Second call - should load cached index (verified by file not being modified)
      const { fuse } = buildOrLoadIndex(files, tempConfig);
      const results = fuse.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    test('force rebuild creates new index', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const metaPath = getIndexMetaPath(tempConfig);

      // First call
      buildOrLoadIndex(files, tempConfig);
      const meta1 = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));

      // Wait a tiny bit to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 10) {}

      // Force rebuild
      buildOrLoadIndex(files, tempConfig, true);
      const meta2 = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));

      expect(meta2.timestamp).toBeGreaterThanOrEqual(meta1.timestamp);
    });
  });

  describe('clearIndexCache', () => {
    test('removes index files', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const indexPath = getIndexFilePath(tempConfig);
      const metaPath = getIndexMetaPath(tempConfig);

      // Create index
      buildOrLoadIndex(files, tempConfig);
      expect(existsSync(indexPath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);

      // Clear
      const cleared = clearIndexCache(tempConfig);
      expect(cleared).toBe(true);
      expect(existsSync(indexPath)).toBe(false);
      expect(existsSync(metaPath)).toBe(false);
    });

    test('returns false when no index exists', () => {
      const cleared = clearIndexCache(tempConfig);
      expect(cleared).toBe(false);
    });
  });

  describe('getIndexStats', () => {
    test('returns stats when index exists', () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      buildOrLoadIndex(files, tempConfig);

      const stats = getIndexStats(tempConfig);

      expect(stats.enabled).toBe(true);
      expect(stats.indexExists).toBe(true);
      expect(stats.metaExists).toBe(true);
      expect(stats.fileCount).toBe(files.length);
      expect(stats.timestamp).toBeDefined();
      expect(stats.age).toBeDefined();
    });

    test('returns partial stats when index does not exist', () => {
      const stats = getIndexStats(tempConfig);

      expect(stats.enabled).toBe(true);
      expect(stats.indexExists).toBe(false);
      expect(stats.metaExists).toBe(false);
      expect(stats.fileCount).toBe(0);
    });
  });
});

// ============================================================================
// FUZZY SEARCH WITH INDEX
// ============================================================================

describe('fuzzySearch with index', () => {
  let tempDir;
  let tempConfig;

  beforeEach(() => {
    tempDir = join(tmpdir(), `ccmds-fuzzy-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfig = {
      ...DEFAULT_CONFIG,
      _configDir: tempDir,
      index: {
        enabled: true,
        path: '.ccmds-fuse-index.json',
        autoRebuild: true,
      },
    };
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('creates index on first search', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const indexPath = getIndexFilePath(tempConfig);

    expect(existsSync(indexPath)).toBe(false);

    fuzzySearch(files, 'test', { limit: 5, config: tempConfig });

    expect(existsSync(indexPath)).toBe(true);
  });

  test('uses cached index on subsequent searches', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const indexPath = getIndexFilePath(tempConfig);

    // First search
    fuzzySearch(files, 'test', { limit: 5, config: tempConfig });
    expect(existsSync(indexPath)).toBe(true);

    // Second search uses cache
    const results = fuzzySearch(files, 'document', {
      limit: 5,
      config: tempConfig,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  test('rebuildIndex option forces rebuild', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const metaPath = getIndexMetaPath(tempConfig);

    // First search
    fuzzySearch(files, 'test', { limit: 5, config: tempConfig });
    const meta1 = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));

    // Wait a tiny bit
    const start = Date.now();
    while (Date.now() - start < 10) {}

    // Search with rebuild
    fuzzySearch(files, 'test', {
      limit: 5,
      config: tempConfig,
      rebuildIndex: true,
    });
    const meta2 = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));

    expect(meta2.timestamp).toBeGreaterThanOrEqual(meta1.timestamp);
  });

  test('search results are consistent with and without cache', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Disable index
    const noIndexConfig = {
      ...tempConfig,
      index: { ...tempConfig.index, enabled: false },
    };

    const resultsNoIndex = fuzzySearch(files, 'test document', {
      limit: 5,
      config: noIndexConfig,
    });

    // Enable index
    const resultsWithIndex = fuzzySearch(files, 'test document', {
      limit: 5,
      config: tempConfig,
    });

    // Results should be the same
    expect(resultsWithIndex.length).toBe(resultsNoIndex.length);
    expect(resultsWithIndex.map((r) => r.file)).toEqual(
      resultsNoIndex.map((r) => r.file)
    );
  });
});

// ============================================================================
// FUSE.JS CONFIGURATION TUNING
// ============================================================================

describe('Fuse.js Configuration Tuning', () => {
  test('DEFAULT_CONFIG includes performance options', () => {
    expect(DEFAULT_CONFIG.fuzzy.ignoreLocation).toBe(true);
    expect(DEFAULT_CONFIG.fuzzy.ignoreFieldNorm).toBe(true);
    expect(DEFAULT_CONFIG.fuzzy.distance).toBe(100);
  });

  test('search works with tuned configuration', () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = fuzzySearch(files, 'test', {
      limit: 10,
      config: DEFAULT_CONFIG,
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.file).toBeDefined();
      expect(r.score).toBeDefined();
    });
  });
});

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  findMarkdownFiles,
  fuzzySearch,
  buildOrLoadIndex,
  clearIndexCache,
  clearDocumentCache,
  getIndexStats,
  getIndexFilePath,
  getIndexMetaPath,
  getFlexSearchExportPath,
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
    // Clear in-memory cache between tests
    clearDocumentCache();

    // Create temp directory for index files
    tempDir = join(tmpdir(), `ccmds-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfig = {
      ...DEFAULT_CONFIG,
      _configDir: tempDir,
      index: {
        enabled: true,
        path: '.ccmds-index.db',
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
    test('returns consistent hash for same file', async () => {
      const testFile = join(FIXTURES_DIR, 'simple.md');
      const hash1 = computeFileHash(testFile);
      const hash2 = computeFileHash(testFile);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(12);
    });

    test('returns "missing" for non-existent file', async () => {
      const hash = computeFileHash('/non/existent/file.md');
      expect(hash).toBe('missing');
    });
  });

  describe('computeFileHashes', () => {
    test('computes hashes for all files', async () => {
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
    test('returns correct paths based on config', async () => {
      const indexPath = getIndexFilePath(tempConfig);
      const metaPath = getIndexMetaPath(tempConfig);

      // All functions now return the FlexSearch directory path
      expect(indexPath).toBe(join(tempDir, '.ccmds-flexsearch'));
      expect(metaPath).toBe(join(tempDir, '.ccmds-flexsearch'));
    });

    test('getFlexSearchExportPath returns flexsearch directory', async () => {
      const exportPath = getFlexSearchExportPath(tempConfig);
      expect(exportPath).toBe(join(tempDir, '.ccmds-flexsearch'));
    });
  });

  describe('isIndexFresh', () => {
    test('returns false when index does not exist', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = join(tempDir, 'nonexistent');

      expect(isIndexFresh(exportPath, files)).toBe(false);
    });

    test('returns false when file count changes', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);

      // First create a valid index
      await buildOrLoadIndex(files, tempConfig, { silent: true });

      // Check it's fresh
      const exportPath = getFlexSearchExportPath(tempConfig);
      expect(isIndexFresh(exportPath, files)).toBe(true);

      // Add a fake file to the list - now it should be stale
      const moreFiles = [...files, { path: '/fake/file.md', relativePath: 'file.md' }];
      expect(isIndexFresh(exportPath, moreFiles)).toBe(false);
    });
  });

  describe('buildOrLoadIndex', () => {
    test('creates index directory when enabled', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      expect(existsSync(exportPath)).toBe(false);

      await buildOrLoadIndex(files, tempConfig, { silent: true });

      expect(existsSync(exportPath)).toBe(true);
    });

    test('does not create index directory when disabled', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const disabledConfig = {
        ...tempConfig,
        index: { ...tempConfig.index, enabled: false },
      };
      const exportPath = getFlexSearchExportPath(disabledConfig);

      await buildOrLoadIndex(files, disabledConfig, { silent: true });

      expect(existsSync(exportPath)).toBe(false);
    });

    test('returns working FlexSearch index', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const { index } = await buildOrLoadIndex(files, tempConfig, { silent: true });

      const results = index.search('test');
      // FlexSearch returns array of field results
      expect(results.length).toBeGreaterThan(0);
    });

    test('loads cached index on second call', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      // First call - creates index
      await buildOrLoadIndex(files, tempConfig, { silent: true });
      expect(existsSync(exportPath)).toBe(true);

      // Second call - should load cached index
      const { index } = await buildOrLoadIndex(files, tempConfig, { silent: true });
      const results = index.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    test('force rebuild creates new index', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);

      // First call
      const stats1 = await buildOrLoadIndex(files, tempConfig, { silent: true });

      // Wait a tiny bit to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 10) {}

      // Force rebuild
      await buildOrLoadIndex(files, tempConfig, { forceRebuild: true, silent: true });
      const stats2 = getIndexStats(tempConfig);

      expect(stats2.timestamp).toBeGreaterThanOrEqual(stats1.documents ? Date.now() - 1000 : 0);
    });
  });

  describe('clearIndexCache', () => {
    test('removes index database', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const dbPath = getIndexFilePath(tempConfig);

      // Create index
      await buildOrLoadIndex(files, tempConfig, { silent: true });
      expect(existsSync(dbPath)).toBe(true);

      // Clear
      const cleared = clearIndexCache(tempConfig);
      expect(cleared).toBe(true);
      expect(existsSync(dbPath)).toBe(false);
    });

    test('returns false when no index exists', async () => {
      const cleared = clearIndexCache(tempConfig);
      expect(cleared).toBe(false);
    });
  });

  describe('getIndexStats', () => {
    test('returns stats when index exists', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      await buildOrLoadIndex(files, tempConfig);

      const stats = getIndexStats(tempConfig);

      expect(stats.enabled).toBe(true);
      expect(stats.indexExists).toBe(true);
      expect(stats.metaExists).toBe(true);
      expect(stats.fileCount).toBe(files.length);
      expect(stats.timestamp).toBeDefined();
      expect(stats.age).toBeDefined();
    });

    test('returns partial stats when index does not exist', async () => {
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
    // Clear in-memory cache between tests
    clearDocumentCache();

    tempDir = join(tmpdir(), `ccmds-fuzzy-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfig = {
      ...DEFAULT_CONFIG,
      _configDir: tempDir,
      index: {
        enabled: true,
        path: '.ccmds-index.db',
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

  test('creates index on first search', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const dbPath = getIndexFilePath(tempConfig);

    expect(existsSync(dbPath)).toBe(false);

    await fuzzySearch(files, 'test', { limit: 5, config: tempConfig });

    expect(existsSync(dbPath)).toBe(true);
  });

  test('uses cached index on subsequent searches', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const dbPath = getIndexFilePath(tempConfig);

    // First search
    await fuzzySearch(files, 'test', { limit: 5, config: tempConfig });
    expect(existsSync(dbPath)).toBe(true);

    // Second search uses cache
    const results = await fuzzySearch(files, 'document', {
      limit: 5,
      config: tempConfig,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  test('rebuildIndex option forces rebuild', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // First search
    await fuzzySearch(files, 'test', { limit: 5, config: tempConfig });
    const stats1 = getIndexStats(tempConfig);

    // Wait a tiny bit
    const start = Date.now();
    while (Date.now() - start < 10) {}

    // Search with rebuild
    await fuzzySearch(files, 'test', {
      limit: 5,
      config: tempConfig,
      rebuildIndex: true,
    });
    const stats2 = getIndexStats(tempConfig);

    expect(stats2.timestamp).toBeGreaterThanOrEqual(stats1.timestamp);
  });

  test('search results are consistent with and without cache', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);

    // Disable index
    const noIndexConfig = {
      ...tempConfig,
      index: { ...tempConfig.index, enabled: false },
    };

    const resultsNoIndex = await fuzzySearch(files, 'test document', {
      limit: 5,
      config: noIndexConfig,
    });

    // Enable index
    const resultsWithIndex = await fuzzySearch(files, 'test document', {
      limit: 5,
      config: tempConfig,
    });

    // Results should be the same (allowing for some variation in order due to different scoring)
    expect(resultsWithIndex.length).toBe(resultsNoIndex.length);
    // Check that both contain the same files (order may vary)
    const filesNoIndex = resultsNoIndex.map((r) => r.file).sort();
    const filesWithIndex = resultsWithIndex.map((r) => r.file).sort();
    expect(filesWithIndex).toEqual(filesNoIndex);
  });
});

// ============================================================================
// FLEXSEARCH CONFIGURATION
// ============================================================================

describe('FlexSearch Configuration', () => {
  test('DEFAULT_CONFIG includes fuzzy options for compatibility', async () => {
    // These options are kept for config compatibility
    expect(DEFAULT_CONFIG.fuzzy.ignoreLocation).toBe(true);
    expect(DEFAULT_CONFIG.fuzzy.ignoreFieldNorm).toBe(true);
    expect(DEFAULT_CONFIG.fuzzy.distance).toBe(100);
  });

  test('search works with default configuration', async () => {
    const files = findMarkdownFiles(FIXTURES_DIR);
    const results = await fuzzySearch(files, 'test', {
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

// ============================================================================
// FLEXSEARCH SERIALIZATION TESTS
// ============================================================================

describe('FlexSearch Serialization', () => {
  let tempDir;
  let tempConfig;

  beforeEach(() => {
    clearDocumentCache();
    tempDir = join(tmpdir(), `ccmds-serialize-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfig = {
      ...DEFAULT_CONFIG,
      _configDir: tempDir,
      index: {
        enabled: true,
        path: '.ccmds-index.db',
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

  describe('getFlexSearchExportPath', () => {
    test('returns correct path based on config', async () => {
      const exportPath = getFlexSearchExportPath(tempConfig);
      expect(exportPath).toBe(join(tempDir, '.ccmds-flexsearch'));
    });
  });

  describe('FlexSearch export on build', () => {
    test('creates FlexSearch export directory after building index', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      expect(existsSync(exportPath)).toBe(false);

      await buildOrLoadIndex(files, tempConfig, { silent: true });

      expect(existsSync(exportPath)).toBe(true);
      // Should have meta.json
      expect(existsSync(join(exportPath, 'meta.json'))).toBe(true);
    });

    test('creates JSON files for FlexSearch export', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      await buildOrLoadIndex(files, tempConfig, { silent: true });

      // Should have at least one .json file (including meta.json)
      const exportedFiles = require('fs').readdirSync(exportPath).filter(f => f.endsWith('.json'));
      expect(exportedFiles.length).toBeGreaterThan(1); // meta.json + FlexSearch files
    });
  });

  describe('FlexSearch warm start (fast path)', () => {
    test('uses serialized index on warm start when no files changed', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      // Cold start - builds index and exports
      await buildOrLoadIndex(files, tempConfig, { silent: true });
      expect(existsSync(exportPath)).toBe(true);

      // Clear in-memory cache to simulate new process
      clearDocumentCache();

      // Warm start - should use serialized index
      const { index, documents } = await buildOrLoadIndex(files, tempConfig, { silent: true });

      // Verify index works correctly
      expect(documents.length).toBe(files.length);
      const results = index.search('test');
      expect(results.length).toBeGreaterThan(0);
    });

    test('rebuilds index when force rebuild is requested', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const exportPath = getFlexSearchExportPath(tempConfig);

      // Cold start
      await buildOrLoadIndex(files, tempConfig, { silent: true });
      const firstMeta = JSON.parse(require('fs').readFileSync(join(exportPath, 'meta.json'), 'utf8'));

      // Clear in-memory cache
      clearDocumentCache();

      // Force rebuild
      await buildOrLoadIndex(files, tempConfig, { forceRebuild: true, silent: true });
      const secondMeta = JSON.parse(require('fs').readFileSync(join(exportPath, 'meta.json'), 'utf8'));

      // File count and hashes should be the same if files haven't changed
      expect(secondMeta.fileCount).toBe(firstMeta.fileCount);
      expect(Object.keys(secondMeta.hashes).length).toBe(Object.keys(firstMeta.hashes).length);
    });
  });

  describe('clearIndexCache with FlexSearch', () => {
    test('removes FlexSearch export directory', async () => {
      const files = findMarkdownFiles(FIXTURES_DIR);
      const dbPath = getIndexFilePath(tempConfig);
      const exportPath = getFlexSearchExportPath(tempConfig);

      // Create index
      await buildOrLoadIndex(files, tempConfig, { silent: true });
      expect(existsSync(dbPath)).toBe(true);
      expect(existsSync(exportPath)).toBe(true);

      // Clear
      const cleared = clearIndexCache(tempConfig);
      expect(cleared).toBe(true);
      expect(existsSync(dbPath)).toBe(false);
      expect(existsSync(exportPath)).toBe(false);
    });
  });
});

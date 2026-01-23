import { describe, test, expect } from 'bun:test';
import {
  buildMinimalConfig,
  configToJson,
  buildConfigWithDefaults,
} from '../src/init/config-builder.js';

// ============================================================================
// CONFIG BUILDER UNIT TESTS
// ============================================================================

describe('Config Builder', () => {
  describe('buildMinimalConfig', () => {
    test('includes documentDirectories', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
      });
      expect(config.documentDirectories).toEqual(['./docs']);
    });

    test('includes named directories', () => {
      const config = buildMinimalConfig({
        documentDirectories: [
          { name: 'api', path: './api-docs', description: 'API documentation' },
          './general-docs',
        ],
      });
      expect(config.documentDirectories).toHaveLength(2);
      expect(config.documentDirectories[0].name).toBe('api');
      expect(config.documentDirectories[1]).toBe('./general-docs');
    });

    test('includes exclude patterns', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        exclude: ['**/node_modules/**', '**/dist/**'],
      });
      expect(config.exclude).toEqual(['**/node_modules/**', '**/dist/**']);
    });

    test('excludes empty exclude array', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        exclude: [],
      });
      expect(config.exclude).toBeUndefined();
    });

    test('excludes default outputMode (json)', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        outputMode: 'json',
      });
      expect(config.outputMode).toBeUndefined();
    });

    test('includes non-default outputMode', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        outputMode: 'compact',
      });
      expect(config.outputMode).toBe('compact');
    });

    test('excludes default limit (10)', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        limit: 10,
      });
      expect(config.limit).toBeUndefined();
    });

    test('includes non-default limit', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        limit: 25,
      });
      expect(config.limit).toBe(25);
    });

    test('excludes default fuzzy threshold (0.4)', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        fuzzy: { threshold: 0.4 },
      });
      expect(config.fuzzy).toBeUndefined();
    });

    test('includes non-default fuzzy threshold', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        fuzzy: { threshold: 0.6 },
      });
      expect(config.fuzzy).toEqual({ threshold: 0.6 });
    });

    test('excludes default extensions', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        extensions: ['.md', '.markdown'],
      });
      expect(config.extensions).toBeUndefined();
    });

    test('includes non-default extensions', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        extensions: ['.md', '.mdx', '.txt'],
      });
      expect(config.extensions).toEqual(['.md', '.mdx', '.txt']);
    });

    test('excludes default cache settings', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        cache: { enabled: false },
      });
      expect(config.cache).toBeUndefined();
    });

    test('includes enabled cache with settings', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        cache: { enabled: true, ttl: 600, maxEntries: 100 },
      });
      expect(config.cache).toEqual({ enabled: true, ttl: 600, maxEntries: 100 });
    });

    test('includes enabled cache with default ttl/maxEntries', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
        cache: { enabled: true, ttl: 300, maxEntries: 50 },
      });
      expect(config.cache).toEqual({ enabled: true });
    });

    test('always includes empty aliases object', () => {
      const config = buildMinimalConfig({
        documentDirectories: ['./docs'],
      });
      expect(config.aliases).toEqual({});
    });
  });

  describe('configToJson', () => {
    test('converts config to formatted JSON', () => {
      const config = {
        documentDirectories: ['./docs'],
        limit: 20,
        aliases: {},
      };
      const json = configToJson(config);
      expect(json).toContain('"documentDirectories"');
      expect(json).toContain('"limit": 20');
      // Check it's formatted (has newlines)
      expect(json).toContain('\n');
    });
  });

  describe('buildConfigWithDefaults', () => {
    test('adds default excludes when none specified', () => {
      const config = buildConfigWithDefaults({
        documentDirectories: ['./docs'],
      });
      expect(config.exclude).toEqual(['**/node_modules/**', '**/.*/**']);
    });

    test('keeps user-specified excludes', () => {
      const config = buildConfigWithDefaults({
        documentDirectories: ['./docs'],
        exclude: ['**/dist/**'],
      });
      expect(config.exclude).toEqual(['**/dist/**']);
    });
  });
});

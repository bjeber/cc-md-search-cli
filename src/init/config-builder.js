/**
 * Config builder for interactive init
 * Generates minimal configs containing only non-default values
 */

// Default values (must match DEFAULT_CONFIG in cli.js)
const DEFAULTS = {
  documentDirectories: ['.'],
  exclude: [],
  outputMode: 'json',
  limit: 10,
  fuzzy: {
    threshold: 0.4,
  },
  extensions: ['.md', '.markdown'],
  cache: {
    enabled: false,
    ttl: 300,
    maxEntries: 50,
  },
};

/**
 * Check if two arrays are equal
 * @param {any[]} a - First array
 * @param {any[]} b - Second array
 * @returns {boolean} - true if equal
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((val, i) => {
    if (typeof val === 'object' && typeof b[i] === 'object') {
      return JSON.stringify(val) === JSON.stringify(b[i]);
    }
    return val === b[i];
  });
}

/**
 * Build a minimal config object with only non-default values
 * @param {object} values - All configuration values from prompts
 * @returns {object} - Minimal config object
 */
export function buildMinimalConfig(values) {
  const config = {};

  // Document directories - always include since it's required
  // and defaults to ['./docs'] in generated config, not ['.']
  if (values.documentDirectories) {
    config.documentDirectories = values.documentDirectories;
  }

  // Exclude patterns
  if (values.exclude && values.exclude.length > 0) {
    // Only include if different from empty array default
    config.exclude = values.exclude;
  }

  // Output mode
  if (values.outputMode && values.outputMode !== DEFAULTS.outputMode) {
    config.outputMode = values.outputMode;
  }

  // Limit
  if (values.limit !== undefined && values.limit !== DEFAULTS.limit) {
    config.limit = values.limit;
  }

  // Fuzzy settings
  if (values.fuzzy) {
    const fuzzyConfig = {};
    if (values.fuzzy.threshold !== undefined &&
        values.fuzzy.threshold !== DEFAULTS.fuzzy.threshold) {
      fuzzyConfig.threshold = values.fuzzy.threshold;
    }
    if (Object.keys(fuzzyConfig).length > 0) {
      config.fuzzy = fuzzyConfig;
    }
  }

  // Extensions
  if (values.extensions && !arraysEqual(values.extensions, DEFAULTS.extensions)) {
    config.extensions = values.extensions;
  }

  // Cache settings
  if (values.cache) {
    const cacheConfig = {};
    if (values.cache.enabled !== DEFAULTS.cache.enabled) {
      cacheConfig.enabled = values.cache.enabled;
    }
    if (values.cache.enabled) {
      // Only include TTL and maxEntries if cache is enabled
      if (values.cache.ttl !== DEFAULTS.cache.ttl) {
        cacheConfig.ttl = values.cache.ttl;
      }
      if (values.cache.maxEntries !== DEFAULTS.cache.maxEntries) {
        cacheConfig.maxEntries = values.cache.maxEntries;
      }
    }
    if (Object.keys(cacheConfig).length > 0) {
      config.cache = cacheConfig;
    }
  }

  // Aliases - always empty object for now
  config.aliases = {};

  return config;
}

/**
 * Convert config object to formatted JSON string
 * @param {object} config - Configuration object
 * @returns {string} - Formatted JSON string
 */
export function configToJson(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Build config with default exclude patterns
 * @param {object} values - Configuration values
 * @returns {object} - Config with default excludes if none specified
 */
export function buildConfigWithDefaults(values) {
  const config = buildMinimalConfig(values);

  // If no excludes specified, add common defaults
  if (!config.exclude || config.exclude.length === 0) {
    config.exclude = ['**/node_modules/**', '**/.*/**'];
  }

  return config;
}

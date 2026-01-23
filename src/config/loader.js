/**
 * Configuration file loading and merging
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { CONFIG_FILE_NAMES, DEFAULT_CONFIG } from './constants.js';

/**
 * Find config file by walking up directory tree
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Path to config file or null
 */
export function findConfigFile(startDir = process.cwd()) {
  let currentDir = startDir;

  // Walk up directory tree
  while (currentDir !== dirname(currentDir)) {
    for (const configName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, configName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }

  // Check home directory as fallback
  const homeDir = homedir();
  for (const configName of CONFIG_FILE_NAMES) {
    const configPath = join(homeDir, configName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Load and parse configuration file
 * @param {string} configPath - Path to config file
 * @returns {object} - Parsed configuration
 */
export function loadConfigFile(configPath) {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // Store the config file directory for resolving relative paths
    config._configDir = dirname(configPath);
    config._configPath = configPath;

    return config;
  } catch (err) {
    console.error(`Error loading config file '${configPath}': ${err.message}`);
    return null;
  }
}

/**
 * Load configuration with hierarchical lookup
 * @param {object} options - CLI options that may override config
 * @returns {object} - Merged configuration
 */
export function loadConfig(options = {}) {
  let config;

  // If --no-config flag is set, return defaults
  // Commander.js sets options.config = false for --no-config, not options.noConfig = true
  if (options.noConfig || options.config === false) {
    config = { ...DEFAULT_CONFIG, _source: 'defaults' };
  } else if (options.config) {
    // If explicit config path provided
    const fileConfig = loadConfigFile(options.config);
    if (fileConfig) {
      config = mergeConfig(DEFAULT_CONFIG, fileConfig, options);
    } else {
      console.error(`Config file not found: ${options.config}`);
      process.exit(1);
    }
  } else {
    // Hierarchical lookup
    const configPath = findConfigFile();
    if (configPath) {
      const fileConfig = loadConfigFile(configPath);
      if (fileConfig) {
        config = mergeConfig(DEFAULT_CONFIG, fileConfig, options);
      } else {
        config = { ...DEFAULT_CONFIG, _source: 'defaults' };
      }
    } else {
      config = { ...DEFAULT_CONFIG, _source: 'defaults' };
    }
  }

  // Handle --no-cache flag
  if (options.noCache) {
    config.cache = { ...config.cache, enabled: false };
  }

  return config;
}

/**
 * Deep merge configuration objects
 * @param {object} defaults - Default configuration
 * @param {object} fileConfig - Configuration from file
 * @param {object} cliOptions - CLI options (highest priority)
 * @returns {object} - Merged configuration
 */
export function mergeConfig(defaults, fileConfig, cliOptions = {}) {
  const merged = { ...defaults };

  // Merge file config
  if (fileConfig) {
    for (const key of Object.keys(fileConfig)) {
      if (key.startsWith('_')) continue; // Skip internal keys

      if (
        typeof fileConfig[key] === 'object' &&
        !Array.isArray(fileConfig[key]) &&
        fileConfig[key] !== null
      ) {
        merged[key] = { ...defaults[key], ...fileConfig[key] };
      } else {
        merged[key] = fileConfig[key];
      }
    }
    merged._source = fileConfig._configPath || 'file';
    merged._configDir = fileConfig._configDir;
  }

  // CLI options override (map CLI option names to config keys)
  if (cliOptions.output) merged.outputMode = cliOptions.output;
  if (cliOptions.limit) merged.limit = parseInt(cliOptions.limit);

  return merged;
}

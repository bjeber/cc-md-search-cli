/**
 * Interactive prompts for init command
 */

import { input, select, checkbox, confirm } from '@inquirer/prompts';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  validateDirectoryPath,
  validateDirectoryName,
  validateGlobPattern,
  validateNumberInRange,
  validateFuzzyThreshold,
  validateExtensions,
  parseExtensions,
  directoryExists,
  expandTilde,
} from './validators.js';
import { createSpinner, printSuccess, printInfo, printWarning, theme } from './ui.js';

/**
 * Common exclude patterns with descriptions
 */
const COMMON_EXCLUDE_PATTERNS = [
  { name: '**/node_modules/**', value: '**/node_modules/**', description: 'Node.js dependencies' },
  { name: '**/.*/**', value: '**/.*/**', description: 'Hidden directories' },
  { name: '**/dist/**', value: '**/dist/**', description: 'Build output' },
  { name: '**/build/**', value: '**/build/**', description: 'Build output' },
  { name: '**/.git/**', value: '**/.git/**', description: 'Git directory' },
  { name: '**/vendor/**', value: '**/vendor/**', description: 'Vendor dependencies' },
  { name: '**/__pycache__/**', value: '**/__pycache__/**', description: 'Python cache' },
  { name: '**/coverage/**', value: '**/coverage/**', description: 'Test coverage' },
];

/**
 * Output mode options
 */
const OUTPUT_MODES = [
  { name: 'json - Structured JSON output (recommended)', value: 'json' },
  { name: 'compact - Condensed text output', value: 'compact' },
  { name: 'detailed - Verbose text output', value: 'detailed' },
  { name: 'files - File paths only', value: 'files' },
];

/**
 * Prompt for a single document directory with optional naming
 * @param {number} index - Directory index (1-based)
 * @returns {Promise<string|{name: string, path: string, description?: string}>}
 */
async function promptSingleDirectory(index) {
  const pathPrompt = index === 1
    ? 'Enter a documentation directory path'
    : 'Enter another directory path';

  const path = await input({
    message: pathPrompt,
    default: index === 1 ? './docs' : undefined,
    validate: validateDirectoryPath,
  });

  const trimmedPath = path.trim();
  const expandedPath = expandTilde(trimmedPath);
  const resolvedPath = resolve(expandedPath);

  // Check if directory exists
  if (!directoryExists(trimmedPath)) {
    const shouldCreate = await confirm({
      message: `Directory '${trimmedPath}' doesn't exist. Create it?`,
      default: true,
    });

    if (shouldCreate) {
      const spinner = createSpinner(`Creating ${trimmedPath}...`);
      spinner.start();
      try {
        mkdirSync(resolvedPath, { recursive: true });
        spinner.succeed(`Created ${trimmedPath}`);
      } catch (error) {
        spinner.fail(`Failed to create ${trimmedPath}: ${error.message}`);
        // Continue anyway - user might create it later
      }
    }
  }

  // Ask if user wants to give it a name
  const wantsName = await confirm({
    message: 'Give this directory a custom name?',
    default: false,
  });

  if (!wantsName) {
    return trimmedPath;
  }

  const name = await input({
    message: 'Short name for this directory',
    validate: validateDirectoryName,
  });

  const wantsDescription = await confirm({
    message: 'Add a description?',
    default: false,
  });

  if (!wantsDescription) {
    return { name: name.trim(), path: trimmedPath };
  }

  const description = await input({
    message: 'Description',
  });

  return {
    name: name.trim(),
    path: trimmedPath,
    ...(description.trim() && { description: description.trim() }),
  };
}

/**
 * Prompt for document directories (loop to add multiple)
 * @param {string[]} [prefilledDirs] - Pre-filled directories from CLI args
 * @returns {Promise<Array<string|{name: string, path: string, description?: string}>>}
 */
export async function promptDocumentDirectories(prefilledDirs = []) {
  const directories = [];

  // If pre-filled directories provided, let user modify/confirm them
  if (prefilledDirs.length > 0) {
    printInfo(`Pre-filled directories: ${prefilledDirs.join(', ')}`);
    for (const dir of prefilledDirs) {
      directories.push(dir);
    }

    const addMore = await confirm({
      message: 'Add more directories?',
      default: false,
    });

    if (!addMore) {
      return directories;
    }
  }

  // Prompt for directories
  let index = directories.length + 1;
  let continueAdding = true;

  while (continueAdding) {
    const dir = await promptSingleDirectory(index);
    directories.push(dir);
    index++;

    continueAdding = await confirm({
      message: 'Add another directory?',
      default: false,
    });
  }

  return directories;
}

/**
 * Prompt for exclude patterns
 * @returns {Promise<string[]>}
 */
export async function promptExcludePatterns() {
  const wantsExclude = await confirm({
    message: 'Add exclude patterns?',
    default: false,
  });

  if (!wantsExclude) {
    return [];
  }

  const selected = await checkbox({
    message: 'Select exclude patterns',
    choices: COMMON_EXCLUDE_PATTERNS.map(p => ({
      name: `${p.name} ${theme.muted(`(${p.description})`)}`,
      value: p.value,
      checked: false,
    })),
  });

  const addCustom = await confirm({
    message: 'Add custom exclude patterns?',
    default: false,
  });

  if (!addCustom) {
    return selected;
  }

  const customPatterns = [];
  let addMore = true;

  while (addMore) {
    const pattern = await input({
      message: 'Enter glob pattern (e.g., **/temp/**)',
      validate: validateGlobPattern,
    });

    customPatterns.push(pattern.trim());

    addMore = await confirm({
      message: 'Add another pattern?',
      default: false,
    });
  }

  return [...selected, ...customPatterns];
}

/**
 * Prompt for output mode
 * @returns {Promise<string>}
 */
export async function promptOutputMode() {
  return select({
    message: 'Default output mode',
    choices: OUTPUT_MODES,
    default: 'json',
  });
}

/**
 * Prompt for advanced options
 * @returns {Promise<{limit?: number, fuzzy?: {threshold: number}, extensions?: string[], cache?: object}|null>}
 */
export async function promptAdvancedOptions() {
  const configureAdvanced = await confirm({
    message: 'Configure advanced options?',
    default: false,
  });

  if (!configureAdvanced) {
    return null;
  }

  const advanced = {};

  // Result limit
  const limit = await input({
    message: 'Maximum results to return',
    default: '10',
    validate: validateNumberInRange(1, 100),
  });
  advanced.limit = parseInt(limit, 10);

  // Fuzzy threshold
  const threshold = await input({
    message: 'Fuzzy search threshold (0=exact, 1=loose)',
    default: '0.4',
    validate: validateFuzzyThreshold,
  });
  advanced.fuzzy = { threshold: parseFloat(threshold) };

  // File extensions
  const extensions = await input({
    message: 'File extensions (comma-separated)',
    default: '.md, .markdown',
    validate: validateExtensions,
  });
  advanced.extensions = parseExtensions(extensions);

  // Caching
  const enableCache = await confirm({
    message: 'Enable result caching?',
    default: false,
  });

  if (enableCache) {
    const ttl = await input({
      message: 'Cache TTL in seconds',
      default: '300',
      validate: validateNumberInRange(1, 86400),
    });

    const maxEntries = await input({
      message: 'Maximum cache entries',
      default: '50',
      validate: validateNumberInRange(1, 1000),
    });

    advanced.cache = {
      enabled: true,
      ttl: parseInt(ttl, 10),
      maxEntries: parseInt(maxEntries, 10),
    };
  } else {
    advanced.cache = { enabled: false };
  }

  return advanced;
}

/**
 * Confirm configuration and write file
 * @param {string} preview - Formatted config preview
 * @returns {Promise<boolean>}
 */
export async function confirmConfiguration(preview) {
  console.log();
  console.log(theme.heading('Configuration Preview'));
  console.log(theme.muted('─'.repeat(30)));
  console.log(preview);
  console.log();

  return confirm({
    message: 'Write this configuration?',
    default: true,
  });
}

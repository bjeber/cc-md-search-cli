/**
 * Interactive init command orchestrator
 */

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  promptDocumentDirectories,
  promptExcludePatterns,
  promptOutputMode,
  promptAdvancedOptions,
  confirmConfiguration,
} from './prompts.js';
import { buildMinimalConfig, configToJson } from './config-builder.js';
import {
  printHeading,
  printSuccess,
  printError,
  printWarning,
  formatConfigPreview,
  theme,
} from './ui.js';

/**
 * Run the interactive init wizard
 * @param {object} options - CLI options
 * @param {boolean} options.force - Overwrite existing config
 * @param {string[]} options.directories - Pre-filled directories
 * @returns {Promise<void>}
 */
export async function runInteractiveInit(options = {}) {
  const configPath = join(process.cwd(), '.ccmdsrc');

  // Check for existing config
  if (existsSync(configPath) && !options.force) {
    printError(`Config file already exists: ${configPath}`);
    console.log(theme.muted('Use --force to overwrite'));
    process.exit(1);
  }

  console.log();
  console.log(theme.primary('ccmds init') + ' - Configuration Wizard');
  console.log(theme.muted('Press Ctrl+C at any time to cancel'));

  try {
    // === BASIC CONFIGURATION ===
    printHeading('BASIC CONFIGURATION');

    // 1. Document directories
    const directories = await promptDocumentDirectories(options.directories);

    // 2. Exclude patterns
    const exclude = await promptExcludePatterns();

    // 3. Output mode
    const outputMode = await promptOutputMode();

    // === ADVANCED CONFIGURATION ===
    printHeading('ADVANCED CONFIGURATION');

    const advancedOptions = await promptAdvancedOptions();

    // === BUILD CONFIG ===
    const configValues = {
      documentDirectories: directories,
      exclude,
      outputMode,
    };

    if (advancedOptions) {
      Object.assign(configValues, advancedOptions);
    }

    const config = buildMinimalConfig(configValues);

    // === CONFIRMATION ===
    const preview = formatConfigPreview(config);
    const confirmed = await confirmConfiguration(preview);

    if (!confirmed) {
      console.log(theme.muted('Configuration cancelled.'));
      process.exit(0);
    }

    // === WRITE CONFIG ===
    const jsonContent = configToJson(config);
    writeFileSync(configPath, jsonContent, 'utf-8');

    console.log();
    printSuccess(`Created ${configPath}`);

  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error.name === 'ExitPromptError' || error.message?.includes('User force closed')) {
      console.log();
      console.log(theme.muted('Configuration cancelled.'));
      process.exit(0);
    }

    // Re-throw other errors
    throw error;
  }
}

export { buildMinimalConfig, configToJson } from './config-builder.js';

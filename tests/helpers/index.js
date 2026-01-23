import { resolve } from 'path';

// Shared fixture directories
export const FIXTURES_DIR = resolve(import.meta.dir, '../fixtures');
export const SECOND_DOCS_DIR = resolve(import.meta.dir, '../fixtures/second-docs');
export const NESTED_DIR = resolve(import.meta.dir, '../fixtures/nested');
export const CLI_PATH = resolve(import.meta.dir, '../../src/cli.js');

/**
 * Helper to run CLI command with a specific runtime
 * @param {string} runtime - 'bun' or 'node'
 * @param {string[]} args - CLI arguments
 * @param {object} options - Spawn options
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export const runCli = (runtime, args, options = {}) => {
  const result = Bun.spawnSync([runtime, CLI_PATH, ...args], {
    cwd: options.cwd || import.meta.dir,
    env: process.env,
  });
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  };
};

/**
 * Version and update system for ccmds
 */

export const PACKAGE_VERSION = '1.0.4';

/**
 * Check npm registry for latest version
 * @returns {Promise<{current: string, latest: string|null, updateAvailable: boolean}>}
 */
export async function checkForUpdate() {
  try {
    const response = await fetch(
      'https://registry.npmjs.org/cc-md-search-cli/latest'
    );
    if (!response.ok)
      return { current: PACKAGE_VERSION, latest: null, updateAvailable: false };
    const data = await response.json();
    const latestVersion = data.version;
    return {
      current: PACKAGE_VERSION,
      latest: latestVersion,
      updateAvailable: latestVersion !== PACKAGE_VERSION,
    };
  } catch {
    return { current: PACKAGE_VERSION, latest: null, updateAvailable: false };
  }
}

/**
 * Handle custom version output with update check
 * Must be called before program.parse() for async handling
 */
export async function handleVersionFlag() {
  if (process.argv.includes('-v') || process.argv.includes('--version')) {
    const { current, latest, updateAvailable } = await checkForUpdate();
    console.log(`cc-md-search-cli v${current}`);
    if (updateAvailable) {
      console.log(`\nUpdate available: ${latest}`);
      console.log('Run `ccmds update` to install');
    }
    process.exit(0);
  }
}

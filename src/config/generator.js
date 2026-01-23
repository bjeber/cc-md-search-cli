/**
 * Configuration file generator
 */

/**
 * Generate default configuration content
 * @param {object} options - Options for config generation
 * @returns {string} - JSON configuration content
 */
export function generateDefaultConfig(options = {}) {
  const config = {
    documentDirectories: options.directories || ['./docs'],
    exclude: ['**/node_modules/**', '**/.*/**'],
    outputMode: 'json',
    limit: 10,
    fuzzy: {
      threshold: 0.4,
    },
    extensions: ['.md', '.markdown'],
    aliases: {},
  };

  return JSON.stringify(config);
}

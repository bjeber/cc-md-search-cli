/**
 * Configuration constants for ccmds
 */

export const CONFIG_FILE_NAMES = [
  '.ccmdsrc',
  '.ccmdsrc.json',
  'ccmds.config.json',
];

export const DEFAULT_CONFIG = {
  documentDirectories: ['.'],
  exclude: [],
  outputMode: 'json',
  limit: 10,
  fuzzy: {
    threshold: 0.4,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    distance: 100,
    weights: {
      title: 2,
      description: 1.5,
      tags: 1.5,
      body: 1,
    },
  },
  preview: {
    topResults: 600,
    midResults: 300,
    otherResults: 150,
    maxLines: 20,
  },
  frontmatterFields: [
    'title',
    'description',
    'tags',
    'category',
    'summary',
    'keywords',
  ],
  extensions: ['.md', '.markdown'],
  aliases: {},
  cache: {
    enabled: false,
    ttl: 300,
    maxEntries: 50,
  },
  index: {
    enabled: true,
    path: '.ccmds-flexsearch/',
    autoRebuild: true,
  },
};

export const USEFUL_FRONTMATTER = [
  'title',
  'description',
  'tags',
  'category',
  'summary',
  'keywords',
];

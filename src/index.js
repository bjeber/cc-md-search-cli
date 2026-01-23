/**
 * Main barrel export for cc-md-search-cli
 * Re-exports all public API from individual modules
 */

// Configuration
export {
  CONFIG_FILE_NAMES,
  DEFAULT_CONFIG,
  USEFUL_FRONTMATTER,
  findConfigFile,
  loadConfigFile,
  loadConfig,
  mergeConfig,
  formatOutputPath,
  normalizeDocumentDirectories,
  resolveDirectories,
  generateDefaultConfig,
} from './config/index.js';

// Files
export {
  shouldExclude,
  matchGlobPattern,
  matchParts,
  matchSegment,
  findMarkdownFiles,
  findMarkdownFilesFromDirs,
} from './files/index.js';

// Parsing
export {
  extractHeadings,
  findParentHeading,
  buildHeadingPath,
  extractFirstHeading,
  extractSmartContext,
  parseMarkdownFile,
  filterFrontmatter,
  extractSection,
} from './parsing/index.js';

// Cache
export {
  generateCacheKey,
  getCacheFilePath,
  readCache,
  writeCache,
  getCachedResult,
  setCachedResult,
  clearCache,
  getCacheStats,
} from './cache/index.js';

// Index Persistence
export {
  INDEX_VERSION,
  getIndexFilePath,
  getIndexMetaPath,
  getDocumentCachePath,
  getFlexSearchExportPath,
  computeFileHash,
  computeFileHashes,
  isIndexFresh,
  buildFuseKeys,
  buildOrLoadIndex,
  clearIndexCache,
  clearDocumentCache,
  getIndexStats,
} from './index-persistence/index.js';

// Search
export {
  grepSearch,
  fuzzySearch,
  findBestMatchFromIndices,
  charOffsetToLineNumber,
  extractParagraphContext,
} from './search/index.js';

// Output
export { formatOutput } from './output/index.js';

// Version
export {
  PACKAGE_VERSION,
  checkForUpdate,
  handleVersionFlag,
} from './version/index.js';

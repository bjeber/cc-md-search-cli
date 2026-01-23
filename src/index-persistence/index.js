/**
 * Index persistence module exports
 */

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
  buildFlexSearchFields,
  buildOrLoadIndex,
  clearIndexCache,
  clearDocumentCache,
  getIndexStats,
} from './flexsearch-index.js';

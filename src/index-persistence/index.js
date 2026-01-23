/**
 * Index persistence module exports
 */

export {
  INDEX_VERSION,
  getIndexFilePath,
  getIndexMetaPath,
  getDocumentCachePath,
  computeFileHash,
  computeFileHashes,
  isIndexFresh,
  buildFuseKeys,
  buildOrLoadIndex,
  clearIndexCache,
  clearDocumentCache,
  getIndexStats,
} from './fuse-index.js';

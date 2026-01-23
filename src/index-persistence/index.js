/**
 * Index persistence module exports
 */

export {
  INDEX_VERSION,
  getIndexFilePath,
  getIndexMetaPath,
  computeFileHash,
  computeFileHashes,
  isIndexFresh,
  buildFuseKeys,
  buildOrLoadIndex,
  clearIndexCache,
  getIndexStats,
} from './fuse-index.js';

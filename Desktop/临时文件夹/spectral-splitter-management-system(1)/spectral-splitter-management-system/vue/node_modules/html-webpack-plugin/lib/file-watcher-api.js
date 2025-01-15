// @ts-check
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("webpack/lib/FileSystemInfo").Snapshot} Snapshot */
'use strict';

/**
 *
 * @param {{fileDependencies: string[], contextDependencies: string[], missingDependencies: string[]}} fileDependencies
 * @param {WebpackCompilation} mainCompilation
 * @param {number} startTime
 */
function createSnapshot (fileDependencies, mainCompilation, startTime) {
  return new Promise((resolve, reject) => {
    mainCompilation.fileSystemInfo.createSnapshot(
      startTime,
      fileDependencies.fileDependencies,
      fileDependencies.contextDependencies,
      fileDependencies.missingDependencies,
      null,
      (err, snapshot) => {
        if (err) {
          return reject(err);
        }
        resolve(snapshot);
      }
    );
  });
}

/**
 * Returns true if the files inside this snapshot
 * have not been changed
 *
 * @param {Snapshot} snapshot
 * @param {WebpackCompilation} mainCompilation
 * @returns {Promise<boolean>}
 */
function isSnapShotValid (snapshot, mainCompilation) {
  return new Promise((resolve, reject) => {
    mainCompilation.fileSystemInfo.checkSnapshotValid(
      snapshot,
      (err, isValid) => {
        if (err) {
          reject(err);
        }
        resolve(isValid);
      }
    );
  });
}

/**
 * Ensure that the files keep watched for changes
 * and will trigger a recompile
 *
 * @param {WebpackCompilation} mainCompilation
 * @param {{fileDependencies: string[], contextDependencies: string[], missingDependencies: string[]}} fileDependencies
 */
function watchFiles (mainCompilation, fileDependencies) {
  Object.keys(fileDependencies).forEach((depencyTypes) => {
    fileDependencies[depencyTypes].forEach(fileDependency => {
      mainCompilation[depencyTypes].add(fileDependency);
    });
  });
}

module.exports = {
  createSnapshot,
  isSnapShotValid,
  watchFiles
};

// @ts-check
/**
 * @file
 * Helper plugin manages the cached state of the child compilation
 *
 * To optimize performance the child compilation is running asyncronously.
 * Therefore it needs to be started in the compiler.make phase and ends after
 * the compilation.afterCompile phase.
 *
 * To prevent bugs from blocked hooks there is no promise or event based api
 * for this plugin.
 *
 * Example usage:
 *
 * ```js
    const childCompilerPlugin = new PersistentChildCompilerPlugin();
    childCompilerPlugin.addEntry('./src/index.js');
    compiler.hooks.afterCompile.tapAsync('MyPlugin', (compilation, callback) => {
      console.log(childCompilerPlugin.getCompilationResult()['./src/index.js']));
      return true;
    });
 * ```
 */

// Import types
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {{hash: string, entry: any, content: string }} ChildCompilationResultEntry */
/** @typedef {import("./file-watcher-api").Snapshot} Snapshot */
/** @typedef {{fileDependencies: string[], contextDependencies: string[], missingDependencies: string[]}} FileDependencies */
/** @typedef {{
  dependencies: FileDependencies,
  compiledEntries: {[entryName: string]: ChildCompilationResultEntry}
} | {
  dependencies: FileDependencies,
  error: Error
}} ChildCompilationResult */
'use strict';

const { HtmlWebpackChildCompiler } = require('./child-compiler');
const fileWatcherApi = require('./file-watcher-api');

/**
 * This plugin is a singleton for performance reasons.
 * To keep track if a plugin does already exist for the compiler they are cached
 * in this map
 * @type {WeakMap<WebpackCompiler, PersistentChildCompilerSingletonPlugin>}}
 */
const compilerMap = new WeakMap();

class CachedChildCompilation {
  /**
   * @param {WebpackCompiler} compiler
   */
  constructor (compiler) {
    /**
     * @private
     * @type {WebpackCompiler}
     */
    this.compiler = compiler;
    // Create a singleton instance for the compiler
    // if there is none
    if (compilerMap.has(compiler)) {
      return;
    }
    const persistentChildCompilerSingletonPlugin = new PersistentChildCompilerSingletonPlugin();
    compilerMap.set(compiler, persistentChildCompilerSingletonPlugin);
    persistentChildCompilerSingletonPlugin.apply(compiler);
  }

  /**
   * apply is called by the webpack main compiler during the start phase
   * @param {string} entry
   */
  addEntry (entry) {
    const persistentChildCompilerSingletonPlugin = compilerMap.get(this.compiler);
    if (!persistentChildCompilerSingletonPlugin) {
      throw new Error(
        'PersistentChildCompilerSingletonPlugin instance not found.'
      );
    }
    persistentChildCompilerSingletonPlugin.addEntry(entry);
  }

  getCompilationResult () {
    const persistentChildCompilerSingletonPlugin = compilerMap.get(this.compiler);
    if (!persistentChildCompilerSingletonPlugin) {
      throw new Error(
        'PersistentChildCompilerSingletonPlugin instance not found.'
      );
    }
    return persistentChildCompilerSingletonPlugin.getLatestResult();
  }

  /**
   * Returns the result for the given entry
   * @param {string} entry
   * @returns {
      | { mainCompilationHash: string, error: Error }
      | { mainCompilationHash: string, compiledEntry: ChildCompilationResultEntry }
    }
   */
  getCompilationEntryResult (entry) {
    const latestResult = this.getCompilationResult();
    const compilationResult = latestResult.compilationResult;
    return 'error' in compilationResult ? {
      mainCompilationHash: latestResult.mainCompilationHash,
      error: compilationResult.error
    } : {
      mainCompilationHash: latestResult.mainCompilationHash,
      compiledEntry: compilationResult.compiledEntries[entry]
    };
  }
}

class PersistentChildCompilerSingletonPlugin {
  constructor () {
    /**
     * @private
     * @type {
      | {
        isCompiling: false,
        isVerifyingCache: false,
        entries: string[],
        compiledEntries: string[],
        mainCompilationHash: string,
        compilationResult: ChildCompilationResult
      }
    | Readonly<{
      isCompiling: false,
      isVerifyingCache: true,
      entries: string[],
      previousEntries: string[],
      previousResult: ChildCompilationResult
    }>
    | Readonly <{
      isVerifyingCache: false,
      isCompiling: true,
      entries: string[],
    }>
  } the internal compilation state */
    this.compilationState = {
      isCompiling: false,
      isVerifyingCache: false,
      entries: [],
      compiledEntries: [],
      mainCompilationHash: 'initial',
      compilationResult: {
        dependencies: {
          fileDependencies: [],
          contextDependencies: [],
          missingDependencies: []
        },
        compiledEntries: {}
      }
    };
  }

  /**
   * apply is called by the webpack main compiler during the start phase
   * @param {WebpackCompiler} compiler
   */
  apply (compiler) {
    /** @type Promise<ChildCompilationResult> */
    let childCompilationResultPromise = Promise.resolve({
      dependencies: {
        fileDependencies: [],
        contextDependencies: [],
        missingDependencies: []
      },
      compiledEntries: {}
    });
    /**
     * The main compilation hash which will only be updated
     * if the childCompiler changes
     */
    let mainCompilationHashOfLastChildRecompile = '';
    /** @typedef{Snapshot|undefined} */
    let previousFileSystemSnapshot;
    let compilationStartTime = new Date().getTime();

    compiler.hooks.make.tapAsync(
      'PersistentChildCompilerSingletonPlugin',
      (mainCompilation, callback) => {
        if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
          return callback(new Error('Child compilation has already started'));
        }

        // Update the time to the current compile start time
        compilationStartTime = new Date().getTime();

        // The compilation starts - adding new templates is now not possible anymore
        this.compilationState = {
          isCompiling: false,
          isVerifyingCache: true,
          previousEntries: this.compilationState.compiledEntries,
          previousResult: this.compilationState.compilationResult,
          entries: this.compilationState.entries
        };

        // Validate cache:
        const isCacheValidPromise = this.isCacheValid(previousFileSystemSnapshot, mainCompilation);

        let cachedResult = childCompilationResultPromise;
        childCompilationResultPromise = isCacheValidPromise.then((isCacheValid) => {
          // Reuse cache
          if (isCacheValid) {
            return cachedResult;
          }
          // Start the compilation
          const compiledEntriesPromise = this.compileEntries(
            mainCompilation,
            this.compilationState.entries
          );
          // Update snapshot as soon as we know the filedependencies
          // this might possibly cause bugs if files were changed inbetween
          // compilation start and snapshot creation
          compiledEntriesPromise.then((childCompilationResult) => {
            return fileWatcherApi.createSnapshot(childCompilationResult.dependencies, mainCompilation, compilationStartTime);
          }).then((snapshot) => {
            previousFileSystemSnapshot = snapshot;
          });
          return compiledEntriesPromise;
        });

        // Add files to compilation which needs to be watched:
        mainCompilation.hooks.optimizeTree.tapAsync(
          'PersistentChildCompilerSingletonPlugin',
          (chunks, modules, callback) => {
            const handleCompilationDonePromise = childCompilationResultPromise.then(
              childCompilationResult => {
                this.watchFiles(
                  mainCompilation,
                  childCompilationResult.dependencies
                );
              });
            handleCompilationDonePromise.then(() => callback(null, chunks, modules), callback);
          }
        );

        // Store the final compilation once the main compilation hash is known
        mainCompilation.hooks.additionalAssets.tapAsync(
          'PersistentChildCompilerSingletonPlugin',
          (callback) => {
            const didRecompilePromise = Promise.all([childCompilationResultPromise, cachedResult]).then(
              ([childCompilationResult, cachedResult]) => {
                // Update if childCompilation changed
                return (cachedResult !== childCompilationResult);
              }
            );

            const handleCompilationDonePromise = Promise.all([childCompilationResultPromise, didRecompilePromise]).then(
              ([childCompilationResult, didRecompile]) => {
                // Update hash and snapshot if childCompilation changed
                if (didRecompile) {
                  mainCompilationHashOfLastChildRecompile = mainCompilation.hash;
                }
                this.compilationState = {
                  isCompiling: false,
                  isVerifyingCache: false,
                  entries: this.compilationState.entries,
                  compiledEntries: this.compilationState.entries,
                  compilationResult: childCompilationResult,
                  mainCompilationHash: mainCompilationHashOfLastChildRecompile
                };
              });
            handleCompilationDonePromise.then(() => callback(null), callback);
          }
        );

        // Continue compilation:
        callback(null);
      }
    );
  }

  /**
   * Add a new entry to the next compile run
   * @param {string} entry
   */
  addEntry (entry) {
    if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
      throw new Error(
        'The child compiler has already started to compile. ' +
        "Please add entries before the main compiler 'make' phase has started or " +
        'after the compilation is done.'
      );
    }
    if (this.compilationState.entries.indexOf(entry) === -1) {
      this.compilationState.entries = [...this.compilationState.entries, entry];
    }
  }

  getLatestResult () {
    if (this.compilationState.isCompiling || this.compilationState.isVerifyingCache) {
      throw new Error(
        'The child compiler is not done compiling. ' +
        "Please access the result after the compiler 'make' phase has started or " +
        'after the compilation is done.'
      );
    }
    return {
      mainCompilationHash: this.compilationState.mainCompilationHash,
      compilationResult: this.compilationState.compilationResult
    };
  }

  /**
   * Verify that the cache is still valid
   * @private
   * @param {Snapshot | undefined} snapshot
   * @param {WebpackCompilation} mainCompilation
   * @returns {Promise<boolean>}
   */
  isCacheValid (snapshot, mainCompilation) {
    if (!this.compilationState.isVerifyingCache) {
      return Promise.reject(new Error('Cache validation can only be done right before the compilation starts'));
    }
    // If there are no entries we don't need a new child compilation
    if (this.compilationState.entries.length === 0) {
      return Promise.resolve(true);
    }
    // If there are new entries the cache is invalid
    if (this.compilationState.entries !== this.compilationState.previousEntries) {
      return Promise.resolve(false);
    }
    // Mark the cache as invalid if there is no snapshot
    if (!snapshot) {
      return Promise.resolve(false);
    }
    return fileWatcherApi.isSnapShotValid(snapshot, mainCompilation);
  }

  /**
   * Start to compile all templates
   *
   * @private
   * @param {WebpackCompilation} mainCompilation
   * @param {string[]} entries
   * @returns {Promise<ChildCompilationResult>}
   */
  compileEntries (mainCompilation, entries) {
    const compiler = new HtmlWebpackChildCompiler(entries);
    return compiler.compileTemplates(mainCompilation).then((result) => {
      return {
      // The compiled sources to render the content
        compiledEntries: result,
        // The file dependencies to find out if a
        // recompilation is required
        dependencies: compiler.fileDependencies,
        // The main compilation hash can be used to find out
        // if this compilation was done during the current compilation
        mainCompilationHash: mainCompilation.hash
      };
    }, error => ({
      // The compiled sources to render the content
      error,
      // The file dependencies to find out if a
      // recompilation is required
      dependencies: compiler.fileDependencies,
      // The main compilation hash can be used to find out
      // if this compilation was done during the current compilation
      mainCompilationHash: mainCompilation.hash
    }));
  }

  /**
   * @private
   * @param {WebpackCompilation} mainCompilation
   * @param {FileDependencies} files
   */
  watchFiles (mainCompilation, files) {
    fileWatcherApi.watchFiles(mainCompilation, files);
  }
}

module.exports = {
  CachedChildCompilation
};

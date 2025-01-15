"use strict";

const os = require("os");

const {
  SourceMapConsumer
} = require("source-map");

const {
  validate
} = require("schema-utils");

const serialize = require("serialize-javascript");

const {
  Worker
} = require("jest-worker");

const {
  throttleAll,
  cssnanoMinify,
  cssoMinify,
  cleanCssMinify,
  esbuildMinify,
  parcelCssMinify
} = require("./utils");

const schema = require("./options.json");

const {
  minify
} = require("./minify");
/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */

/** @typedef {import("webpack").Compiler} Compiler */

/** @typedef {import("webpack").Compilation} Compilation */

/** @typedef {import("webpack").WebpackError} WebpackError */

/** @typedef {import("jest-worker").Worker} JestWorker */

/** @typedef {import("source-map").RawSourceMap} RawSourceMap */

/** @typedef {import("webpack").Asset} Asset */

/** @typedef {import("postcss").ProcessOptions} ProcessOptions */

/** @typedef {import("postcss").Syntax} Syntax */

/** @typedef {import("postcss").Parser} Parser */

/** @typedef {import("postcss").Stringifier} Stringifier */

/**
 * @typedef {Object} CssNanoOptions
 * @property {string} [configFile]
 * @property {[string, object] | string | undefined} [preset]
 */

/** @typedef {Error & { plugin?: string, text?: string, source?: string } | string} Warning */

/**
 * @typedef {Object} WarningObject
 * @property {string} message
 * @property {string} [plugin]
 * @property {string} [text]
 * @property {number} [line]
 * @property {number} [column]
 */

/**
 * @typedef {Object} ErrorObject
 * @property {string} message
 * @property {number} [line]
 * @property {number} [column]
 * @property {string} [stack]
 */

/**
 * @typedef {Object} MinimizedResult
 * @property {string} code
 * @property {RawSourceMap} [map]
 * @property {Array<Error | ErrorObject| string>} [errors]
 * @property {Array<Warning | WarningObject | string>} [warnings]
 */

/**
 * @typedef {{ [file: string]: string }} Input
 */

/**
 * @typedef {{ [key: string]: any }} CustomOptions
 */

/**
 * @template T
 * @typedef {T extends infer U ? U : CustomOptions} InferDefaultType
 */

/**
 * @template T
 * @callback BasicMinimizerImplementation
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {InferDefaultType<T>} minifyOptions
 * @returns {Promise<MinimizedResult>}
 */

/**
 * @template T
 * @typedef {T extends any[] ? { [P in keyof T]: BasicMinimizerImplementation<T[P]>; } : BasicMinimizerImplementation<T>} MinimizerImplementation
 */

/**
 * @template T
 * @typedef {T extends any[] ? { [P in keyof T]?: InferDefaultType<T[P]> } : InferDefaultType<T>} MinimizerOptions
 */

/**
 * @template T
 * @typedef {Object} InternalOptions
 * @property {string} name
 * @property {string} input
 * @property {RawSourceMap | undefined} inputSourceMap
 * @property {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> }} minimizer
 */

/**
 * @typedef InternalResult
 * @property {Array<{ code: string, map: RawSourceMap | undefined }>} outputs
 * @property {Array<Warning | WarningObject | string>} warnings
 * @property {Array<Error | ErrorObject | string>} errors
 */

/** @typedef {undefined | boolean | number} Parallel */

/** @typedef {RegExp | string} Rule */

/** @typedef {Rule[] | Rule} Rules */

/** @typedef {(warning: Warning | WarningObject | string, file: string, source?: string) => boolean} WarningsFilter */

/**
 * @typedef {Object} BasePluginOptions
 * @property {Rules} [test]
 * @property {Rules} [include]
 * @property {Rules} [exclude]
 * @property {WarningsFilter} [warningsFilter]
 * @property {Parallel} [parallel]
 */

/**
 * @template T
 * @typedef {JestWorker & { transform: (options: string) => InternalResult, minify: (options: InternalOptions<T>) => InternalResult }} MinimizerWorker
 */

/**
 * @typedef{ProcessOptions | { from?: string,  to?: string, parser?: string | Syntax | Parser, stringifier?: string | Syntax | Stringifier, syntax?: string | Syntax } } ProcessOptionsExtender
 */

/**
 * @typedef {CssNanoOptions & { processorOptions?: ProcessOptionsExtender }} CssNanoOptionsExtended
 */

/**
 * @template T
 * @typedef {T extends CssNanoOptionsExtended ? { minify?: MinimizerImplementation<T> | undefined, minimizerOptions?: MinimizerOptions<T> | undefined } : { minify: MinimizerImplementation<T>, minimizerOptions?: MinimizerOptions<T> | undefined }} DefinedDefaultMinimizerAndOptions
 */

/**
 * @template T
 * @typedef {BasePluginOptions & { minimizer: { implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> } }} InternalPluginOptions
 */


const warningRegex = /\s.+:+([0-9]+):+([0-9]+)/;
/**
 * @template [T=CssNanoOptionsExtended]
 */

class CssMinimizerPlugin {
  /**
   * @param {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>} [options]
   */
  constructor(options) {
    validate(
    /** @type {Schema} */
    schema, options || {}, {
      name: "Css Minimizer Plugin",
      baseDataPath: "options"
    });
    const {
      minify =
      /** @type {BasicMinimizerImplementation<T>} */
      cssnanoMinify,
      minimizerOptions =
      /** @type {MinimizerOptions<T>} */
      {},
      test = /\.css(\?.*)?$/i,
      warningsFilter = () => true,
      parallel = true,
      include,
      exclude
    } = options || {};
    /**
     * @private
     * @type {InternalPluginOptions<T>}
     */

    this.options = {
      test,
      warningsFilter,
      parallel,
      include,
      exclude,
      minimizer: {
        implementation:
        /** @type {MinimizerImplementation<T>} */
        minify,
        options: minimizerOptions
      }
    };
  }
  /**
   * @private
   * @param {any} input
   * @returns {boolean}
   */


  static isSourceMap(input) {
    // All required options for `new SourceMapConsumer(...options)`
    // https://github.com/mozilla/source-map#new-sourcemapconsumerrawsourcemap
    return Boolean(input && input.version && input.sources && Array.isArray(input.sources) && typeof input.mappings === "string");
  }
  /**
   * @private
   * @param {Warning | WarningObject | string} warning
   * @param {string} file
   * @param {WarningsFilter} [warningsFilter]
   * @param {SourceMapConsumer} [sourceMap]
   * @param {Compilation["requestShortener"]} [requestShortener]
   * @returns {Error & { hideStack?: boolean, file?: string } | undefined}
   */


  static buildWarning(warning, file, warningsFilter, sourceMap, requestShortener) {
    let warningMessage = typeof warning === "string" ? warning : `${warning.plugin ? `[${warning.plugin}] ` : ""}${warning.text || warning.message}`;
    let locationMessage = "";
    let source;

    if (sourceMap) {
      let line;
      let column;

      if (typeof warning === "string") {
        const match = warningRegex.exec(warning);

        if (match) {
          line = +match[1];
          column = +match[2];
        }
      } else {
        ({
          line,
          column
        } =
        /** @type {WarningObject} */
        warning);
      }

      if (line && column) {
        const original = sourceMap.originalPositionFor({
          line,
          column
        });

        if (original && original.source && original.source !== file && requestShortener) {
          ({
            source
          } = original);
          warningMessage = `${warningMessage.replace(warningRegex, "")}`;
          locationMessage = `${requestShortener.shorten(original.source)}:${original.line}:${original.column}`;
        }
      }
    }

    if (warningsFilter && !warningsFilter(warning, file, source)) {
      return;
    }
    /**
     * @type {Error & { hideStack?: boolean, file?: string }}
     */


    const builtWarning = new Error(`${file} from Css Minimizer plugin\n${warningMessage}${locationMessage ? ` ${locationMessage}` : ""}`);
    builtWarning.name = "Warning";
    builtWarning.hideStack = true;
    builtWarning.file = file; // eslint-disable-next-line consistent-return

    return builtWarning;
  }
  /**
   * @private
   * @param {Error | ErrorObject | string} error
   * @param {string} file
   * @param {SourceMapConsumer} [sourceMap]
   * @param {Compilation["requestShortener"]} [requestShortener]
   * @returns {Error}
   */


  static buildError(error, file, sourceMap, requestShortener) {
    /**
     * @type {Error & { file?: string }}
     */
    let builtError;

    if (typeof error === "string") {
      builtError = new Error(`${file} from Css Minimizer plugin\n${error}`);
      builtError.file = file;
      return builtError;
    }

    if (
    /** @type {ErrorObject} */
    error.line &&
    /** @type {ErrorObject} */
    error.column) {
      const {
        line,
        column
      } =
      /** @type {ErrorObject & { line: number, column: number }} */
      error;
      const original = sourceMap && sourceMap.originalPositionFor({
        line,
        column
      });

      if (original && original.source && requestShortener) {
        builtError = new Error(`${file} from Css Minimizer plugin\n${error.message} [${requestShortener.shorten(original.source)}:${original.line},${original.column}][${file}:${line},${column}]${error.stack ? `\n${error.stack.split("\n").slice(1).join("\n")}` : ""}`);
        builtError.file = file;
        return builtError;
      }

      builtError = new Error(`${file} from Css Minimizer plugin\n${error.message} [${file}:${line},${column}]${error.stack ? `\n${error.stack.split("\n").slice(1).join("\n")}` : ""}`);
      builtError.file = file;
      return builtError;
    }

    if (error.stack) {
      builtError = new Error(`${file} from Css Minimizer plugin\n${error.stack}`);
      builtError.file = file;
      return builtError;
    }

    builtError = new Error(`${file} from Css Minimizer plugin\n${error.message}`);
    builtError.file = file;
    return builtError;
  }
  /**
   * @private
   * @param {Parallel} parallel
   * @returns {number}
   */


  static getAvailableNumberOfCores(parallel) {
    // In some cases cpus() returns undefined
    // https://github.com/nodejs/node/issues/19022
    const cpus = os.cpus() || {
      length: 1
    };
    return parallel === true ? cpus.length - 1 : Math.min(Number(parallel) || 0, cpus.length - 1);
  }
  /**
   * @private
   * @param {Compiler} compiler
   * @param {Compilation} compilation
   * @param {Record<string, import("webpack").sources.Source>} assets
   * @param {{availableNumberOfCores: number}} optimizeOptions
   * @returns {Promise<void>}
   */


  async optimize(compiler, compilation, assets, optimizeOptions) {
    const cache = compilation.getCache("CssMinimizerWebpackPlugin");
    let numberOfAssetsForMinify = 0;
    const assetsForMinify = await Promise.all(Object.keys(typeof assets === "undefined" ? compilation.assets : assets).filter(name => {
      const {
        info
      } =
      /** @type {Asset} */
      compilation.getAsset(name);

      if ( // Skip double minimize assets from child compilation
      info.minimized) {
        return false;
      }

      if (!compiler.webpack.ModuleFilenameHelpers.matchObject.bind( // eslint-disable-next-line no-undefined
      undefined, this.options)(name)) {
        return false;
      }

      return true;
    }).map(async name => {
      const {
        info,
        source
      } =
      /** @type {Asset} */
      compilation.getAsset(name);
      const eTag = cache.getLazyHashedEtag(source);
      const cacheItem = cache.getItemCache(name, eTag);
      const output = await cacheItem.getPromise();

      if (!output) {
        numberOfAssetsForMinify += 1;
      }

      return {
        name,
        info,
        inputSource: source,
        output,
        cacheItem
      };
    }));

    if (assetsForMinify.length === 0) {
      return;
    }
    /** @type {undefined | (() => MinimizerWorker<T>)} */


    let getWorker;
    /** @type {undefined | MinimizerWorker<T>} */

    let initializedWorker;
    /** @type {undefined | number} */

    let numberOfWorkers;

    if (optimizeOptions.availableNumberOfCores > 0) {
      // Do not create unnecessary workers when the number of files is less than the available cores, it saves memory
      numberOfWorkers = Math.min(numberOfAssetsForMinify, optimizeOptions.availableNumberOfCores);

      getWorker = () => {
        if (initializedWorker) {
          return initializedWorker;
        }

        initializedWorker =
        /** @type {MinimizerWorker<T>} */
        new Worker(require.resolve("./minify"), {
          numWorkers: numberOfWorkers,
          enableWorkerThreads: true
        }); // https://github.com/facebook/jest/issues/8872#issuecomment-524822081

        const workerStdout = initializedWorker.getStdout();

        if (workerStdout) {
          workerStdout.on("data", chunk => process.stdout.write(chunk));
        }

        const workerStderr = initializedWorker.getStderr();

        if (workerStderr) {
          workerStderr.on("data", chunk => process.stderr.write(chunk));
        }

        return initializedWorker;
      };
    }

    const {
      SourceMapSource,
      RawSource
    } = compiler.webpack.sources;
    const scheduledTasks = [];

    for (const asset of assetsForMinify) {
      scheduledTasks.push(async () => {
        const {
          name,
          inputSource,
          cacheItem
        } = asset;
        let {
          output
        } = asset;

        if (!output) {
          let input;
          /** @type {RawSourceMap | undefined} */

          let inputSourceMap;
          const {
            source: sourceFromInputSource,
            map
          } = inputSource.sourceAndMap();
          input = sourceFromInputSource;

          if (map) {
            if (!CssMinimizerPlugin.isSourceMap(map)) {
              compilation.warnings.push(
              /** @type {WebpackError} */
              new Error(`${name} contains invalid source map`));
            } else {
              inputSourceMap =
              /** @type {RawSourceMap} */
              map;
            }
          }

          if (Buffer.isBuffer(input)) {
            input = input.toString();
          }
          /**
           * @type {InternalOptions<T>}
           */


          const options = {
            name,
            input,
            inputSourceMap,
            minimizer: {
              implementation: this.options.minimizer.implementation,
              options: this.options.minimizer.options
            }
          };
          let result;

          try {
            result = await (getWorker ? getWorker().transform(serialize(options)) : minify(options));
          } catch (error) {
            const hasSourceMap = inputSourceMap && CssMinimizerPlugin.isSourceMap(inputSourceMap);
            compilation.errors.push(
            /** @type {WebpackError} */
            CssMinimizerPlugin.buildError(
            /** @type {any} */
            error, name, hasSourceMap ? new SourceMapConsumer(
            /** @type {RawSourceMap} */
            inputSourceMap) : // eslint-disable-next-line no-undefined
            undefined, // eslint-disable-next-line no-undefined
            hasSourceMap ? compilation.requestShortener : undefined));
            return;
          }

          output = {
            warnings: [],
            errors: []
          };

          for (const item of result.outputs) {
            if (item.map) {
              let originalSource;
              let innerSourceMap;

              if (output.source) {
                ({
                  source: originalSource,
                  map: innerSourceMap
                } = output.source.sourceAndMap());
              } else {
                originalSource = input;
                innerSourceMap = inputSourceMap;
              } // TODO need API for merging source maps in `webpack-source`


              output.source = new SourceMapSource(item.code, name, item.map, originalSource, innerSourceMap, true);
            } else {
              output.source = new RawSource(item.code);
            }
          }

          if (result.errors && result.errors.length > 0) {
            const hasSourceMap = inputSourceMap && CssMinimizerPlugin.isSourceMap(inputSourceMap);

            for (const error of result.errors) {
              output.warnings.push(CssMinimizerPlugin.buildError(error, name, hasSourceMap ? new SourceMapConsumer(
              /** @type {RawSourceMap} */
              inputSourceMap) : // eslint-disable-next-line no-undefined
              undefined, // eslint-disable-next-line no-undefined
              hasSourceMap ? compilation.requestShortener : undefined));
            }
          }

          if (result.warnings && result.warnings.length > 0) {
            const hasSourceMap = inputSourceMap && CssMinimizerPlugin.isSourceMap(inputSourceMap);

            for (const warning of result.warnings) {
              const buildWarning = CssMinimizerPlugin.buildWarning(warning, name, this.options.warningsFilter, hasSourceMap ? new SourceMapConsumer(
              /** @type {RawSourceMap} */
              inputSourceMap) : // eslint-disable-next-line no-undefined
              undefined, // eslint-disable-next-line no-undefined
              hasSourceMap ? compilation.requestShortener : undefined);

              if (buildWarning) {
                output.warnings.push(buildWarning);
              }
            }
          }

          await cacheItem.storePromise({
            source: output.source,
            warnings: output.warnings,
            errors: output.errors
          });
        }

        if (output.warnings && output.warnings.length > 0) {
          for (const warning of output.warnings) {
            compilation.warnings.push(warning);
          }
        }

        if (output.errors && output.errors.length > 0) {
          for (const error of output.errors) {
            compilation.errors.push(error);
          }
        }

        const newInfo = {
          minimized: true
        };
        const {
          source
        } = output;
        compilation.updateAsset(name, source, newInfo);
      });
    }

    const limit = getWorker && numberOfAssetsForMinify > 0 ?
    /** @type {number} */
    numberOfWorkers : scheduledTasks.length;
    await throttleAll(limit, scheduledTasks);

    if (initializedWorker) {
      await initializedWorker.end();
    }
  }
  /**
   * @param {Compiler} compiler
   * @returns {void}
   */


  apply(compiler) {
    const pluginName = this.constructor.name;
    const availableNumberOfCores = CssMinimizerPlugin.getAvailableNumberOfCores(this.options.parallel);
    compiler.hooks.compilation.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tapPromise({
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        additionalAssets: true
      }, assets => this.optimize(compiler, compilation, assets, {
        availableNumberOfCores
      }));
      compilation.hooks.statsPrinter.tap(pluginName, stats => {
        stats.hooks.print.for("asset.info.minimized").tap("css-minimizer-webpack-plugin", (minimized, {
          green,
          formatFlag
        }) => // eslint-disable-next-line no-undefined
        minimized ?
        /** @type {Function} */
        green(
        /** @type {Function} */
        formatFlag("minimized")) : "");
      });
    });
  }

}

CssMinimizerPlugin.cssnanoMinify = cssnanoMinify;
CssMinimizerPlugin.cssoMinify = cssoMinify;
CssMinimizerPlugin.cleanCssMinify = cleanCssMinify;
CssMinimizerPlugin.esbuildMinify = esbuildMinify;
CssMinimizerPlugin.parcelCssMinify = parcelCssMinify;
module.exports = CssMinimizerPlugin;
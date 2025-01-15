"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _schemaUtils = require("schema-utils");

var _globby = _interopRequireDefault(require("globby"));

var _serializeJavascript = _interopRequireDefault(require("serialize-javascript"));

var _normalizePath = _interopRequireDefault(require("normalize-path"));

var _globParent = _interopRequireDefault(require("glob-parent"));

var _fastGlob = _interopRequireDefault(require("fast-glob"));

var _package = require("../package.json");

var _options = _interopRequireDefault(require("./options.json"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const template = /\[\\*([\w:]+)\\*\]/i;

class CopyPlugin {
  constructor(options = {}) {
    (0, _schemaUtils.validate)(_options.default, options, {
      name: "Copy Plugin",
      baseDataPath: "options"
    });
    this.patterns = options.patterns;
    this.options = options.options || {};
  }

  static async createSnapshot(compilation, startTime, dependency) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      compilation.fileSystemInfo.createSnapshot(startTime, [dependency], // eslint-disable-next-line no-undefined
      undefined, // eslint-disable-next-line no-undefined
      undefined, null, (error, snapshot) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(snapshot);
      });
    });
  }

  static async checkSnapshotValid(compilation, snapshot) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      compilation.fileSystemInfo.checkSnapshotValid(snapshot, (error, isValid) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(isValid);
      });
    });
  }

  static getContentHash(compiler, compilation, source) {
    const {
      outputOptions
    } = compilation;
    const {
      hashDigest,
      hashDigestLength,
      hashFunction,
      hashSalt
    } = outputOptions;
    const hash = compiler.webpack.util.createHash(hashFunction);

    if (hashSalt) {
      hash.update(hashSalt);
    }

    hash.update(source);
    const fullContentHash = hash.digest(hashDigest);
    return fullContentHash.slice(0, hashDigestLength);
  }

  static async runPattern(compiler, compilation, logger, cache, inputPattern, index) {
    const {
      RawSource
    } = compiler.webpack.sources;
    const pattern = typeof inputPattern === "string" ? {
      from: inputPattern
    } : { ...inputPattern
    };
    pattern.fromOrigin = pattern.from;
    pattern.from = _path.default.normalize(pattern.from);
    pattern.context = typeof pattern.context === "undefined" ? compiler.context : _path.default.isAbsolute(pattern.context) ? pattern.context : _path.default.join(compiler.context, pattern.context);
    logger.log(`starting to process a pattern from '${pattern.from}' using '${pattern.context}' context`);

    if (_path.default.isAbsolute(pattern.from)) {
      pattern.absoluteFrom = pattern.from;
    } else {
      pattern.absoluteFrom = _path.default.resolve(pattern.context, pattern.from);
    }

    logger.debug(`getting stats for '${pattern.absoluteFrom}'...`);
    const {
      inputFileSystem
    } = compiler;
    let stats;

    try {
      stats = await (0, _utils.stat)(inputFileSystem, pattern.absoluteFrom);
    } catch (error) {// Nothing
    }

    if (stats) {
      if (stats.isDirectory()) {
        pattern.fromType = "dir";
        logger.debug(`determined '${pattern.absoluteFrom}' is a directory`);
      } else if (stats.isFile()) {
        pattern.fromType = "file";
        logger.debug(`determined '${pattern.absoluteFrom}' is a file`);
      } else {
        logger.debug(`determined '${pattern.absoluteFrom}' is a glob`);
      }
    } // eslint-disable-next-line no-param-reassign


    pattern.globOptions = { ...{
        followSymbolicLinks: true
      },
      ...(pattern.globOptions || {}),
      ...{
        cwd: pattern.context,
        objectMode: true
      }
    };
    pattern.globOptions.fs = inputFileSystem;

    switch (pattern.fromType) {
      case "dir":
        compilation.contextDependencies.add(pattern.absoluteFrom);
        logger.debug(`added '${pattern.absoluteFrom}' as a context dependency`);
        /* eslint-disable no-param-reassign */

        pattern.context = pattern.absoluteFrom;
        pattern.glob = _path.default.posix.join(_fastGlob.default.escapePath((0, _normalizePath.default)(_path.default.resolve(pattern.absoluteFrom))), "**/*");
        pattern.absoluteFrom = _path.default.join(pattern.absoluteFrom, "**/*");

        if (typeof pattern.globOptions.dot === "undefined") {
          pattern.globOptions.dot = true;
        }
        /* eslint-enable no-param-reassign */


        break;

      case "file":
        compilation.fileDependencies.add(pattern.absoluteFrom);
        logger.debug(`added '${pattern.absoluteFrom}' as a file dependency`);
        /* eslint-disable no-param-reassign */

        pattern.context = _path.default.dirname(pattern.absoluteFrom);
        pattern.glob = _fastGlob.default.escapePath((0, _normalizePath.default)(_path.default.resolve(pattern.absoluteFrom)));

        if (typeof pattern.globOptions.dot === "undefined") {
          pattern.globOptions.dot = true;
        }
        /* eslint-enable no-param-reassign */


        break;

      default:
        {
          const contextDependencies = _path.default.normalize((0, _globParent.default)(pattern.absoluteFrom));

          compilation.contextDependencies.add(contextDependencies);
          logger.debug(`added '${contextDependencies}' as a context dependency`);
          /* eslint-disable no-param-reassign */

          pattern.fromType = "glob";
          pattern.glob = _path.default.isAbsolute(pattern.fromOrigin) ? pattern.fromOrigin : _path.default.posix.join(_fastGlob.default.escapePath((0, _normalizePath.default)(_path.default.resolve(pattern.context))), pattern.fromOrigin);
          /* eslint-enable no-param-reassign */
        }
    }

    logger.log(`begin globbing '${pattern.glob}'...`);
    let paths;

    try {
      paths = await (0, _globby.default)(pattern.glob, pattern.globOptions);
    } catch (error) {
      compilation.errors.push(error);
      return;
    }

    if (paths.length === 0) {
      if (pattern.noErrorOnMissing) {
        logger.log(`finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`);
        return;
      }

      const missingError = new Error(`unable to locate '${pattern.glob}' glob`);
      compilation.errors.push(missingError);
      return;
    }

    const filteredPaths = (await Promise.all(paths.map(async item => {
      // Exclude directories
      if (!item.dirent.isFile()) {
        return false;
      }

      if (pattern.filter) {
        let isFiltered;

        try {
          isFiltered = await pattern.filter(item.path);
        } catch (error) {
          compilation.errors.push(error);
          return false;
        }

        if (!isFiltered) {
          logger.log(`skip '${item.path}', because it was filtered`);
        }

        return isFiltered ? item : false;
      }

      return item;
    }))).filter(item => item);

    if (filteredPaths.length === 0) {
      if (pattern.noErrorOnMissing) {
        logger.log(`finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`);
        return;
      }

      const missingError = new Error(`unable to locate '${pattern.glob}' glob after filtering paths`);
      compilation.errors.push(missingError);
      return;
    }

    const files = await Promise.all(filteredPaths.map(async item => {
      const from = item.path;
      logger.debug(`found '${from}'`); // `globby`/`fast-glob` return the relative path when the path contains special characters on windows

      const absoluteFilename = _path.default.resolve(pattern.context, from);

      pattern.to = typeof pattern.to === "function" ? await pattern.to({
        context: pattern.context,
        absoluteFilename
      }) : _path.default.normalize(typeof pattern.to !== "undefined" ? pattern.to : "");

      const isToDirectory = _path.default.extname(pattern.to) === "" || pattern.to.slice(-1) === _path.default.sep;

      const toType = pattern.toType ? pattern.toType : template.test(pattern.to) ? "template" : isToDirectory ? "dir" : "file";
      logger.log(`'to' option '${pattern.to}' determinated as '${toType}'`);

      const relativeFrom = _path.default.relative(pattern.context, absoluteFilename);

      let filename = toType === "dir" ? _path.default.join(pattern.to, relativeFrom) : pattern.to;

      if (_path.default.isAbsolute(filename)) {
        filename = _path.default.relative(compiler.options.output.path, filename);
      }

      logger.log(`determined that '${from}' should write to '${filename}'`);
      const sourceFilename = (0, _normalizePath.default)(_path.default.relative(compiler.context, absoluteFilename));
      return {
        absoluteFilename,
        sourceFilename,
        filename,
        toType
      };
    }));
    let assets;

    try {
      assets = await Promise.all(files.map(async file => {
        const {
          absoluteFilename,
          sourceFilename,
          filename,
          toType
        } = file;
        const info = typeof pattern.info === "function" ? pattern.info(file) || {} : pattern.info || {};
        const result = {
          absoluteFilename,
          sourceFilename,
          filename,
          force: pattern.force,
          info
        }; // If this came from a glob or dir, add it to the file dependencies

        if (pattern.fromType === "dir" || pattern.fromType === "glob") {
          compilation.fileDependencies.add(absoluteFilename);
          logger.debug(`added '${absoluteFilename}' as a file dependency`);
        }

        let cacheEntry;
        logger.debug(`getting cache for '${absoluteFilename}'...`);

        try {
          cacheEntry = await cache.getPromise(`${sourceFilename}|${index}`, null);
        } catch (error) {
          compilation.errors.push(error);
          return;
        }

        if (cacheEntry) {
          logger.debug(`found cache for '${absoluteFilename}'...`);
          let isValidSnapshot;
          logger.debug(`checking snapshot on valid for '${absoluteFilename}'...`);

          try {
            isValidSnapshot = await CopyPlugin.checkSnapshotValid(compilation, cacheEntry.snapshot);
          } catch (error) {
            compilation.errors.push(error);
            return;
          }

          if (isValidSnapshot) {
            logger.debug(`snapshot for '${absoluteFilename}' is valid`);
            result.source = cacheEntry.source;
          } else {
            logger.debug(`snapshot for '${absoluteFilename}' is invalid`);
          }
        } else {
          logger.debug(`missed cache for '${absoluteFilename}'`);
        }

        if (!result.source) {
          const startTime = Date.now();
          logger.debug(`reading '${absoluteFilename}'...`);
          let data;

          try {
            data = await (0, _utils.readFile)(inputFileSystem, absoluteFilename);
          } catch (error) {
            compilation.errors.push(error);
            return;
          }

          logger.debug(`read '${absoluteFilename}'`);
          result.source = new RawSource(data);
          let snapshot;
          logger.debug(`creating snapshot for '${absoluteFilename}'...`);

          try {
            snapshot = await CopyPlugin.createSnapshot(compilation, startTime, absoluteFilename);
          } catch (error) {
            compilation.errors.push(error);
            return;
          }

          if (snapshot) {
            logger.debug(`created snapshot for '${absoluteFilename}'`);
            logger.debug(`storing cache for '${absoluteFilename}'...`);

            try {
              await cache.storePromise(`${sourceFilename}|${index}`, null, {
                source: result.source,
                snapshot
              });
            } catch (error) {
              compilation.errors.push(error);
              return;
            }

            logger.debug(`stored cache for '${absoluteFilename}'`);
          }
        }

        if (pattern.transform) {
          const transform = typeof pattern.transform === "function" ? {
            transformer: pattern.transform
          } : pattern.transform;

          if (transform.transformer) {
            logger.log(`transforming content for '${absoluteFilename}'...`);
            const buffer = result.source.buffer();

            if (transform.cache) {
              // TODO: remove in the next major release
              const hasher = compiler.webpack && compiler.webpack.util && compiler.webpack.util.createHash ? compiler.webpack.util.createHash("xxhash64") : // eslint-disable-next-line global-require
              require("crypto").createHash("md4");
              const defaultCacheKeys = {
                version: _package.version,
                sourceFilename,
                transform: transform.transformer,
                contentHash: hasher.update(buffer).digest("hex"),
                index
              };
              const cacheKeys = `transform|${(0, _serializeJavascript.default)(typeof transform.cache.keys === "function" ? await transform.cache.keys(defaultCacheKeys, absoluteFilename) : { ...defaultCacheKeys,
                ...pattern.transform.cache.keys
              })}`;
              logger.debug(`getting transformation cache for '${absoluteFilename}'...`);
              const cacheItem = cache.getItemCache(cacheKeys, cache.getLazyHashedEtag(result.source));
              result.source = await cacheItem.getPromise();
              logger.debug(result.source ? `found transformation cache for '${absoluteFilename}'` : `no transformation cache for '${absoluteFilename}'`);

              if (!result.source) {
                const transformed = await transform.transformer(buffer, absoluteFilename);
                result.source = new RawSource(transformed);
                logger.debug(`caching transformation for '${absoluteFilename}'...`);
                await cacheItem.storePromise(result.source);
                logger.debug(`cached transformation for '${absoluteFilename}'`);
              }
            } else {
              result.source = new RawSource(await transform.transformer(buffer, absoluteFilename));
            }
          }
        }

        if (toType === "template") {
          logger.log(`interpolating template '${filename}' for '${sourceFilename}'...`);
          const contentHash = CopyPlugin.getContentHash(compiler, compilation, result.source.buffer());

          const ext = _path.default.extname(result.sourceFilename);

          const base = _path.default.basename(result.sourceFilename);

          const name = base.slice(0, base.length - ext.length);
          const data = {
            filename: (0, _normalizePath.default)(_path.default.relative(pattern.context, absoluteFilename)),
            contentHash,
            chunk: {
              name,
              id: result.sourceFilename,
              hash: contentHash,
              contentHash
            }
          };
          const {
            path: interpolatedFilename,
            info: assetInfo
          } = compilation.getPathWithInfo((0, _normalizePath.default)(result.filename), data);
          result.info = { ...result.info,
            ...assetInfo
          };
          result.filename = interpolatedFilename;
          logger.log(`interpolated template '${filename}' for '${sourceFilename}'`);
        } else {
          // eslint-disable-next-line no-param-reassign
          result.filename = (0, _normalizePath.default)(result.filename);
        } // eslint-disable-next-line consistent-return


        return result;
      }));
    } catch (error) {
      compilation.errors.push(error);
      return;
    }

    logger.log(`finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`); // eslint-disable-next-line consistent-return

    return assets;
  }

  apply(compiler) {
    const pluginName = this.constructor.name;
    compiler.hooks.thisCompilation.tap(pluginName, compilation => {
      const logger = compilation.getLogger("copy-webpack-plugin");
      const cache = compilation.getCache("CopyWebpackPlugin");
      compilation.hooks.processAssets.tapAsync({
        name: "copy-webpack-plugin",
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
      }, async (unusedAssets, callback) => {
        logger.log("starting to add additional assets...");
        const assetMap = new Map();
        const scheduledTasks = [];
        this.patterns.map((item, index) => scheduledTasks.push(async () => {
          let assets;

          try {
            assets = await CopyPlugin.runPattern(compiler, compilation, logger, cache, item, index);
          } catch (error) {
            compilation.errors.push(error);
            return;
          }

          if (assets && assets.length > 0) {
            if (item.transformAll) {
              if (typeof item.to === "undefined") {
                compilation.errors.push(new Error(`Invalid "pattern.to" for the "pattern.from": "${item.from}" and "pattern.transformAll" function. The "to" option must be specified.`));
                return;
              }

              assets.sort((a, b) => a.absoluteFilename > b.absoluteFilename ? 1 : a.absoluteFilename < b.absoluteFilename ? -1 : 0);
              const mergedEtag = assets.length === 1 ? cache.getLazyHashedEtag(assets[0].source.buffer()) : assets.reduce((accumulator, asset, i) => {
                // eslint-disable-next-line no-param-reassign
                accumulator = cache.mergeEtags(i === 1 ? cache.getLazyHashedEtag(accumulator.source.buffer()) : accumulator, cache.getLazyHashedEtag(asset.source.buffer()));
                return accumulator;
              });
              const cacheKeys = `transformAll|${(0, _serializeJavascript.default)({
                version: _package.version,
                from: item.from,
                to: item.to,
                transformAll: item.transformAll
              })}`;
              const eTag = cache.getLazyHashedEtag(mergedEtag);
              const cacheItem = cache.getItemCache(cacheKeys, eTag);
              let transformedAsset = await cacheItem.getPromise();

              if (!transformedAsset) {
                transformedAsset = {
                  filename: item.to
                };

                try {
                  transformedAsset.data = await item.transformAll(assets.map(asset => {
                    return {
                      data: asset.source.buffer(),
                      sourceFilename: asset.sourceFilename,
                      absoluteFilename: asset.absoluteFilename
                    };
                  }));
                } catch (error) {
                  compilation.errors.push(error);
                  return;
                }

                if (template.test(item.to)) {
                  const contentHash = CopyPlugin.getContentHash(compiler, compilation, transformedAsset.data);
                  const {
                    path: interpolatedFilename,
                    info: assetInfo
                  } = compilation.getPathWithInfo((0, _normalizePath.default)(item.to), {
                    contentHash,
                    chunk: {
                      hash: contentHash,
                      contentHash
                    }
                  });
                  transformedAsset.filename = interpolatedFilename;
                  transformedAsset.info = assetInfo;
                }

                const {
                  RawSource
                } = compiler.webpack.sources;
                transformedAsset.source = new RawSource(transformedAsset.data);
                transformedAsset.force = item.force;
                await cacheItem.storePromise(transformedAsset);
              }

              assets = [transformedAsset];
            }

            const priority = item.priority || 0;

            if (!assetMap.has(priority)) {
              assetMap.set(priority, []);
            }

            assetMap.get(priority).push(...assets);
          }
        }));
        await (0, _utils.throttleAll)(this.options.concurrency || 100, scheduledTasks);
        const assets = [...assetMap.entries()].sort((a, b) => a[0] - b[0]); // Avoid writing assets inside `p-limit`, because it creates concurrency.
        // It could potentially lead to an error - 'Multiple assets emit different content to the same filename'

        assets.reduce((acc, val) => acc.concat(val[1]), []).filter(Boolean).forEach(asset => {
          const {
            absoluteFilename,
            sourceFilename,
            filename,
            source,
            force
          } = asset;
          const existingAsset = compilation.getAsset(filename);

          if (existingAsset) {
            if (force) {
              const info = {
                copied: true,
                sourceFilename
              };
              logger.log(`force updating '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists...`);
              compilation.updateAsset(filename, source, { ...info,
                ...asset.info
              });
              logger.log(`force updated '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists`);
              return;
            }

            logger.log(`skip adding '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists`);
            return;
          }

          const info = {
            copied: true,
            sourceFilename
          };
          logger.log(`writing '${filename}' from '${absoluteFilename}' to compilation assets...`);
          compilation.emitAsset(filename, source, { ...info,
            ...asset.info
          });
          logger.log(`written '${filename}' from '${absoluteFilename}' to compilation assets`);
        });
        logger.log("finished to adding additional assets");
        callback();
      });

      if (compilation.hooks.statsPrinter) {
        compilation.hooks.statsPrinter.tap(pluginName, stats => {
          stats.hooks.print.for("asset.info.copied").tap("copy-webpack-plugin", (copied, {
            green,
            formatFlag
          }) => // eslint-disable-next-line no-undefined
          copied ? green(formatFlag("copied")) : undefined);
        });
      }
    });
  }

}

var _default = CopyPlugin;
exports.default = _default;
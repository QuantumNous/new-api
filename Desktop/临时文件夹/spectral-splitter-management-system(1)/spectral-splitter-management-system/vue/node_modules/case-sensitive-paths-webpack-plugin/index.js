/* eslint-disable strict */

'use strict';

/* This plugin based on https://gist.github.com/Morhaus/333579c2a5b4db644bd5

 Original license:
 --------
 The MIT License (MIT)
 Copyright (c) 2015 Alexandre Kirszenberg
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 --------

 And it's NPM-ified version: https://github.com/dcousineau/force-case-sensitivity-webpack-plugin
 Author Daniel Cousineau indicated MIT license as well but did not include it

 The originals did not properly case-sensitize the entire path, however. This plugin resolves that issue.

 This plugin license, also MIT:
 --------
 The MIT License (MIT)
 Copyright (c) 2016 Michael Pratt
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 --------
 */

const path = require('path');

function CaseSensitivePathsPlugin(options) {
  this.options = options || {};
  this.logger = this.options.logger || console;
  this.pathCache = new Map();
  this.reset();
}

CaseSensitivePathsPlugin.prototype.reset = function() {
  this.pathCache = new Map();
  this.fsOperations = 0;
  this.primed = false;
};

CaseSensitivePathsPlugin.prototype.getFilenamesInDir = function(dir, callback) {
  const that = this;
  const fs = this.compiler.inputFileSystem;
  this.fsOperations += 1;

  if (this.pathCache.has(dir)) {
    callback(this.pathCache.get(dir));
    return;
  }
  if (this.options.debug) {
    this.logger.log('[CaseSensitivePathsPlugin] Reading directory', dir);
  }

  fs.readdir(dir, (err, files) => {
    if (err) {
      if (that.options.debug) {
        this.logger.log(
          '[CaseSensitivePathsPlugin] Failed to read directory',
          dir,
          err,
        );
      }
      callback([]);
      return;
    }

    callback(files.map((f) => (f.normalize ? f.normalize('NFC') : f)));
  });
};

// This function based on code found at http://stackoverflow.com/questions/27367261/check-if-file-exists-case-sensitive
// By Patrick McElhaney (No license indicated - Stack Overflow Answer)
// This version will return with the real name of any incorrectly-cased portion of the path, null otherwise.
CaseSensitivePathsPlugin.prototype.fileExistsWithCase = function(
  filepath,
  callback,
) {
  // Split filepath into current filename (or directory name) and parent directory tree.
  const that = this;
  const dir = path.dirname(filepath);
  const filename = path.basename(filepath);
  const parsedPath = path.parse(dir);

  // If we are at the root, or have found a path we already know is good, return.
  if (
    parsedPath.dir === parsedPath.root ||
    dir === '.' ||
    that.pathCache.has(filepath)
  ) {
    callback();
    return;
  }

  // Check all filenames in the current dir against current filename to ensure one of them matches.
  // Read from the cache if available, from FS if not.
  that.getFilenamesInDir(dir, (filenames) => {
    // If the exact match does not exist, attempt to find the correct filename.
    if (filenames.indexOf(filename) === -1) {
      // Fallback value which triggers us to abort.
      let correctFilename = '!nonexistent';

      for (let i = 0; i < filenames.length; i += 1) {
        if (filenames[i].toLowerCase() === filename.toLowerCase()) {
          correctFilename = `\`${filenames[i]}\`.`;
          break;
        }
      }
      callback(correctFilename);
      return;
    }

    // If exact match exists, recurse through directory tree until root.
    that.fileExistsWithCase(dir, (recurse) => {
      // If found an error elsewhere, return that correct filename
      // Don't bother caching - we're about to error out anyway.
      if (!recurse) {
        that.pathCache.set(dir, filenames);
      }

      callback(recurse);
    });
  });
};

CaseSensitivePathsPlugin.prototype.primeCache = function(callback) {
  if (this.primed) {
    callback();
    return;
  }

  const that = this;
  // Prime the cache with the current directory. We have to assume the current casing is correct,
  // as in certain circumstances people can switch into an incorrectly-cased directory.
  const currentPath = path.resolve();
  that.getFilenamesInDir(currentPath, (files) => {
    that.pathCache.set(currentPath,files);
    that.primed = true;
    callback();
  });
};

CaseSensitivePathsPlugin.prototype.apply = function(compiler) {
  this.compiler = compiler;

  const onDone = () => {
    if (this.options.debug) {
      this.logger.log(
        '[CaseSensitivePathsPlugin] Total filesystem reads:',
        this.fsOperations,
      );
    }

    this.reset();
  };

  const checkFile = (pathName, data, done) => {
    this.fileExistsWithCase(pathName, (realName) => {
      if (realName) {
        if (realName === '!nonexistent') {
          // If file does not exist, let Webpack show a more appropriate error.
          if (data.createData) done(null);
          else done(null, data);
        } else {
          done(
            new Error(
              `[CaseSensitivePathsPlugin] \`${pathName}\` does not match the corresponding path on disk ${realName}`,
            ),
          );
        }
      } else if (data.createData) {
        done(null);
      } else {
        done(null, data);
      }
    });
  };

  const cleanupPath = (resourcePath) => {
      // Trim ? off, since some loaders add that to the resource they're attemping to load
      return resourcePath.split('?')[0]
        // replace escaped \0# with # see: https://github.com/webpack/enhanced-resolve#escaping
        .replace('\u0000#', '#');
  }

  const onAfterResolve = (data, done) => {
    this.primeCache(() => {
      
      let pathName = cleanupPath((data.createData || data).resource);
      pathName = pathName.normalize ? pathName.normalize('NFC') : pathName;

      checkFile(pathName, data, done);
    });
  };

  if (compiler.hooks) {
    compiler.hooks.done.tap('CaseSensitivePathsPlugin', onDone);
    if (this.options.useBeforeEmitHook) {
      if (this.options.debug) {
        this.logger.log(
          '[CaseSensitivePathsPlugin] Using the hook for before emit.',
        );
      }
      compiler.hooks.emit.tapAsync(
        'CaseSensitivePathsPlugin',
        (compilation, callback) => {
          let resolvedFilesCount = 0;
          const errors = [];
          this.primeCache(() => {
            compilation.fileDependencies.forEach((filename) => {
              checkFile(filename, filename, (error) => {
                resolvedFilesCount += 1;
                if (error) {
                  errors.push(error);
                }
                if (resolvedFilesCount === compilation.fileDependencies.size) {
                  if (errors.length) {
                    // Send all errors to webpack
                    Array.prototype.push.apply(compilation.errors, errors);
                  }
                  callback();
                }
              });
            });
          });
        },
      );
    } else {
      compiler.hooks.normalModuleFactory.tap(
        'CaseSensitivePathsPlugin',
        (nmf) => {
          nmf.hooks.afterResolve.tapAsync(
            'CaseSensitivePathsPlugin',
            onAfterResolve,
          );
        },
      );
    }
  } else {
    compiler.plugin('done', onDone);
    compiler.plugin('normal-module-factory', (nmf) => {
      nmf.plugin('after-resolve', onAfterResolve);
    });
  }
};

module.exports = CaseSensitivePathsPlugin;

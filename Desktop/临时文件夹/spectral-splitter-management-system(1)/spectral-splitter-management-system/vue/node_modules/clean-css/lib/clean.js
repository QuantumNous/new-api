/**
 * Clean-css - https://github.com/clean-css/clean-css
 * Released under the terms of MIT license
 */

var level0Optimize = require('./optimizer/level-0/optimize');
var level1Optimize = require('./optimizer/level-1/optimize');
var level2Optimize = require('./optimizer/level-2/optimize');
var validator = require('./optimizer/validator');

var compatibilityFrom = require('./options/compatibility');
var fetchFrom = require('./options/fetch');
var formatFrom = require('./options/format').formatFrom;
var inlineFrom = require('./options/inline');
var inlineRequestFrom = require('./options/inline-request');
var inlineTimeoutFrom = require('./options/inline-timeout');
var OptimizationLevel = require('./options/optimization-level').OptimizationLevel;
var optimizationLevelFrom = require('./options/optimization-level').optimizationLevelFrom;
var pluginsFrom = require('./options/plugins');
var rebaseFrom = require('./options/rebase');
var rebaseToFrom = require('./options/rebase-to');

var inputSourceMapTracker = require('./reader/input-source-map-tracker');
var readSources = require('./reader/read-sources');

var serializeStyles = require('./writer/simple');
var serializeStylesAndSourceMap = require('./writer/source-maps');

var CleanCSS = module.exports = function CleanCSS(options) {
  options = options || {};

  this.options = {
    batch: !!options.batch,
    compatibility: compatibilityFrom(options.compatibility),
    explicitRebaseTo: 'rebaseTo' in options,
    fetch: fetchFrom(options.fetch),
    format: formatFrom(options.format),
    inline: inlineFrom(options.inline),
    inlineRequest: inlineRequestFrom(options.inlineRequest),
    inlineTimeout: inlineTimeoutFrom(options.inlineTimeout),
    level: optimizationLevelFrom(options.level),
    plugins: pluginsFrom(options.plugins),
    rebase: rebaseFrom(options.rebase, options.rebaseTo),
    rebaseTo: rebaseToFrom(options.rebaseTo),
    returnPromise: !!options.returnPromise,
    sourceMap: !!options.sourceMap,
    sourceMapInlineSources: !!options.sourceMapInlineSources
  };
};

// for compatibility with optimize-css-assets-webpack-plugin
CleanCSS.process = function(input, opts) {
  var cleanCss;
  var optsTo = opts.to;

  delete opts.to;
  cleanCss = new CleanCSS(Object.assign({
    returnPromise: true, rebaseTo: optsTo
  }, opts));

  return cleanCss.minify(input)
    .then(function(output) {
      return { css: output.styles };
    });
};

CleanCSS.prototype.minify = function(input, maybeSourceMap, maybeCallback) {
  var options = this.options;

  if (options.returnPromise) {
    return new Promise(function(resolve, reject) {
      minifyAll(input, options, maybeSourceMap, function(errors, output) {
        return errors
          ? reject(errors)
          : resolve(output);
      });
    });
  }
  return minifyAll(input, options, maybeSourceMap, maybeCallback);
};

function minifyAll(input, options, maybeSourceMap, maybeCallback) {
  if (options.batch && Array.isArray(input)) {
    return minifyInBatchesFromArray(input, options, maybeSourceMap, maybeCallback);
  } if (options.batch && (typeof input == 'object')) {
    return minifyInBatchesFromHash(input, options, maybeSourceMap, maybeCallback);
  }
  return minify(input, options, maybeSourceMap, maybeCallback);
}

function minifyInBatchesFromArray(input, options, maybeSourceMap, maybeCallback) {
  var callback = typeof maybeCallback == 'function'
    ? maybeCallback
    : (typeof maybeSourceMap == 'function' ? maybeSourceMap : null);
  var errors = [];
  var outputAsHash = {};
  var inputValue;
  var i, l;

  function whenHashBatchDone(innerErrors, output) {
    outputAsHash = Object.assign(outputAsHash, output);

    if (innerErrors !== null) {
      errors = errors.concat(innerErrors);
    }
  }

  for (i = 0, l = input.length; i < l; i++) {
    if (typeof input[i] == 'object') {
      minifyInBatchesFromHash(input[i], options, whenHashBatchDone);
    } else {
      inputValue = input[i];

      outputAsHash[inputValue] = minify([inputValue], options);
      errors = errors.concat(outputAsHash[inputValue].errors);
    }
  }

  return callback
    ? callback(errors.length > 0 ? errors : null, outputAsHash)
    : outputAsHash;
}

function minifyInBatchesFromHash(input, options, maybeSourceMap, maybeCallback) {
  var callback = typeof maybeCallback == 'function'
    ? maybeCallback
    : (typeof maybeSourceMap == 'function' ? maybeSourceMap : null);
  var errors = [];
  var outputAsHash = {};
  var inputKey;
  var inputValue;

  for (inputKey in input) {
    inputValue = input[inputKey];

    outputAsHash[inputKey] = minify(inputValue.styles, options, inputValue.sourceMap);
    errors = errors.concat(outputAsHash[inputKey].errors);
  }

  return callback
    ? callback(errors.length > 0 ? errors : null, outputAsHash)
    : outputAsHash;
}

function minify(input, options, maybeSourceMap, maybeCallback) {
  var sourceMap = typeof maybeSourceMap != 'function'
    ? maybeSourceMap
    : null;
  var callback = typeof maybeCallback == 'function'
    ? maybeCallback
    : (typeof maybeSourceMap == 'function' ? maybeSourceMap : null);
  var context = {
    stats: {
      efficiency: 0,
      minifiedSize: 0,
      originalSize: 0,
      startedAt: Date.now(),
      timeSpent: 0
    },
    cache: { specificity: {} },
    errors: [],
    inlinedStylesheets: [],
    inputSourceMapTracker: inputSourceMapTracker(),
    localOnly: !callback,
    options: options,
    source: null,
    sourcesContent: {},
    validator: validator(options.compatibility),
    warnings: []
  };
  var implicitRebaseToWarning;

  if (sourceMap) {
    context.inputSourceMapTracker.track(undefined, sourceMap);
  }

  if (options.rebase && !options.explicitRebaseTo) {
    implicitRebaseToWarning = 'You have set `rebase: true` without giving `rebaseTo` option, which, in this case, defaults to the current working directory. '
      + 'You are then warned this can lead to unexpected URL rebasing (aka here be dragons)! '
      + 'If you are OK with the clean-css output, then you can get rid of this warning by giving clean-css a `rebaseTo: process.cwd()` option.';
    context.warnings.push(implicitRebaseToWarning);
  }

  return runner(context.localOnly)(function() {
    return readSources(input, context, function(tokens) {
      var serialize = context.options.sourceMap
        ? serializeStylesAndSourceMap
        : serializeStyles;

      var optimizedTokens = optimize(tokens, context);
      var optimizedStyles = serialize(optimizedTokens, context);
      var output = withMetadata(optimizedStyles, context);

      return callback
        ? callback(context.errors.length > 0 ? context.errors : null, output)
        : output;
    });
  });
}

function runner(localOnly) {
  // to always execute code asynchronously when a callback is given
  // more at blog.izs.me/post/59142742143/designing-apis-for-asynchrony
  return localOnly
    ? function(callback) { return callback(); }
    : process.nextTick;
}

function optimize(tokens, context) {
  var optimized = level0Optimize(tokens, context);

  optimized = OptimizationLevel.One in context.options.level
    ? level1Optimize(tokens, context)
    : tokens;
  optimized = OptimizationLevel.Two in context.options.level
    ? level2Optimize(tokens, context, true)
    : optimized;

  return optimized;
}

function withMetadata(output, context) {
  output.stats = calculateStatsFrom(output.styles, context);
  output.errors = context.errors;
  output.inlinedStylesheets = context.inlinedStylesheets;
  output.warnings = context.warnings;

  return output;
}

function calculateStatsFrom(styles, context) {
  var finishedAt = Date.now();
  var timeSpent = finishedAt - context.stats.startedAt;

  delete context.stats.startedAt;
  context.stats.timeSpent = timeSpent;
  context.stats.efficiency = 1 - styles.length / context.stats.originalSize;
  context.stats.minifiedSize = styles.length;

  return context.stats;
}

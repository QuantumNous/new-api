"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pitch = pitch;
exports.warmup = warmup;

var _loaderUtils = _interopRequireDefault(require("loader-utils"));

var _workerPools = require("./workerPools");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function pitch() {
  const options = _loaderUtils.default.getOptions(this);

  const workerPool = (0, _workerPools.getPool)(options);

  if (!workerPool.isAbleToRun()) {
    return;
  }

  const callback = this.async();
  workerPool.run({
    loaders: this.loaders.slice(this.loaderIndex + 1).map(l => {
      return {
        loader: l.path,
        options: l.options,
        ident: l.ident
      };
    }),
    resource: this.resourcePath + (this.resourceQuery || ''),
    sourceMap: this.sourceMap,
    emitError: this.emitError,
    emitWarning: this.emitWarning,
    loadModule: this.loadModule,
    resolve: this.resolve,
    getResolve: this.getResolve,
    target: this.target,
    minimize: this.minimize,
    resourceQuery: this.resourceQuery,
    optionsContext: this.rootContext || this.options.context,
    rootContext: this.rootContext
  }, (err, r) => {
    if (r) {
      r.fileDependencies.forEach(d => this.addDependency(d));
      r.contextDependencies.forEach(d => this.addContextDependency(d));
      r.missingDependencies.forEach(d => this.addMissingDependency(d));
      r.buildDependencies.forEach(d => // Compatibility with webpack v4
      this.addBuildDependency ? this.addBuildDependency(d) : this.addDependency(d));
    }

    if (err) {
      callback(err);
      return;
    }

    callback(null, ...r.result);
  });
}

function warmup(options, requires) {
  const workerPool = (0, _workerPools.getPool)(options);
  workerPool.warmup(requires);
} // eslint-disable-line import/prefer-default-export
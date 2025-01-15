const ChainedMap = require('./ChainedMap');
const Plugin = require('./Plugin');

module.exports = class extends ChainedMap {
  constructor(parent) {
    super(parent);
    this.minimizers = new ChainedMap(this);
    this.extend([
      'concatenateModules',
      'flagIncludedChunks',
      'mergeDuplicateChunks',
      'minimize',
      'namedChunks',
      'namedModules',
      'nodeEnv',
      'noEmitOnErrors',
      'occurrenceOrder',
      'portableRecords',
      'providedExports',
      'removeAvailableModules',
      'removeEmptyChunks',
      'runtimeChunk',
      'sideEffects',
      'splitChunks',
      'usedExports',
    ]);
  }

  minimizer(name) {
    if (Array.isArray(name)) {
      throw new Error(
        'optimization.minimizer() no longer supports being passed an array. ' +
          'Either switch to the new syntax (https://github.com/neutrinojs/webpack-chain#config-optimization-minimizers-adding) or downgrade to webpack-chain 4. ' +
          'If using Vue this likely means a Vue plugin has not yet been updated to support Vue CLI 4+.',
      );
    }

    return this.minimizers.getOrCompute(
      name,
      () => new Plugin(this, name, 'optimization.minimizer'),
    );
  }

  toConfig() {
    return this.clean(
      Object.assign(this.entries() || {}, {
        minimizer: this.minimizers.values().map((plugin) => plugin.toConfig()),
      }),
    );
  }

  merge(obj, omit = []) {
    if (!omit.includes('minimizer') && 'minimizer' in obj) {
      Object.keys(obj.minimizer).forEach((name) =>
        this.minimizer(name).merge(obj.minimizer[name]),
      );
    }

    return super.merge(obj, [...omit, 'minimizer']);
  }
};

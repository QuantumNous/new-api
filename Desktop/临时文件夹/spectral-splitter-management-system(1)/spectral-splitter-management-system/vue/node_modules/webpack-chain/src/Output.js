const ChainedMap = require('./ChainedMap');

module.exports = class extends ChainedMap {
  constructor(parent) {
    super(parent);
    this.extend([
      'auxiliaryComment',
      'chunkCallbackName',
      'chunkFilename',
      'chunkLoadTimeout',
      'crossOriginLoading',
      'devtoolFallbackModuleFilenameTemplate',
      'devtoolLineToLine',
      'devtoolModuleFilenameTemplate',
      'devtoolNamespace',
      'filename',
      'futureEmitAssets',
      'globalObject',
      'hashDigest',
      'hashDigestLength',
      'hashFunction',
      'hashSalt',
      'hotUpdateChunkFilename',
      'hotUpdateFunction',
      'hotUpdateMainFilename',
      'jsonpFunction',
      'library',
      'libraryExport',
      'libraryTarget',
      'path',
      'pathinfo',
      'publicPath',
      'sourceMapFilename',
      'sourcePrefix',
      'strictModuleExceptionHandling',
      'umdNamedDefine',
      'webassemblyModuleFilename',
    ]);
  }
};

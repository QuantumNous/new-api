const config = require('../base/base');

module.exports = {
  ...config,
  "stories": [
    '../../packages/semi-ui/**/_story/*.stories.(ts|tsx)',
  ],
};


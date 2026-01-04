const config = require('../base/base');
const utils = require('../base/utils');
const nycConfig = require('../../nyc.config');

module.exports = {
  ...config,
  "stories": [
    '../../packages/semi-ui/**/_story/*.stories.(js|jsx)',
  ],
  typescript: {
    check: false,
    checkOptions: {}
  },
  babel: (options) => {
    const istanbulPluginOption = [
      'babel-plugin-istanbul',
      {
        "include": nycConfig.include,
        "exclude": nycConfig.exclude
      }
    ];

    // 如果是测试环境，则插入 istanbul babel 插件
    if (utils.isTest()) {
      options.plugins.unshift(istanbulPluginOption);
    }
    return ({
      ...options,
    })
  },
};

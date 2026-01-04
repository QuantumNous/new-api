const config = require('../../base/base');

module.exports = {
  ...config,
  "stories": [
    '../../../packages/(semi-animation-react|semi-animation-styled)/_story/*.react.stories.(js|jsx)',
  ],
  typescript: {
    check: false,
    checkOptions: {}
  },
};

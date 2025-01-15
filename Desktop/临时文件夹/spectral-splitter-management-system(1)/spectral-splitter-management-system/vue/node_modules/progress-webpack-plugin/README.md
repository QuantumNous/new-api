progress-webpack-plugin  [![npm version](https://badge.fury.io/js/progress-webpack-plugin.svg)](https://badge.fury.io/js/progress-webpack-plugin)
===
[![NPM](https://nodei.co/npm/progress-webpack-plugin.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/progress-webpack-plugin/)

inspired by [progress-bar-webpack-plugin](https://github.com/clessg/progress-bar-webpack-plugin),simple Webpack plugin that display nice progress when build

Install
===

```javascript
npm install progress-webpack-plugin --save--dev
```

Usage
===

add plugin in your webpack.config.js

```javascript
var ProgressPlugin = require('progress-webpack-plugin')

module.exports = {
    ...
    plugins:[
        new ProgressPlugin(true)
    ]
}
```

Plugin Options
===

- **minimal**: enable minimal mode or not,default value is false
- **identifier**: identifier of webpack bundle
- **onStart**: callback function when webpack bundler started
- **onFinish**: callback function when webpack bundler finished
- **onProgress**: callback function when webpack bundler running
- **clear**: whether clear console when webpack bundler finished


## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
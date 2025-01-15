<div align="center">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" vspace="" hspace="25" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]
[![size][size]][size-url]

# thread-loader

Runs the following loaders in a worker pool.

## Getting Started

```bash
npm install --save-dev thread-loader
```

Put this loader in front of other loaders. The following loaders run in a worker pool.

Loaders running in a worker pool are limited. Examples:

- Loaders cannot emit files.
- Loaders cannot use custom loader API (i. e. by plugins).
- Loaders cannot access the webpack options.

Each worker is a separate node.js process, which has an overhead of ~600ms. There is also an overhead of inter-process communication.

Use this loader only for expensive operations!

### Examples

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve('src'),
        use: [
          'thread-loader',
          // your expensive loader (e.g babel-loader)
        ],
      },
    ],
  },
};
```

**with options**

```js
use: [
  {
    loader: 'thread-loader',
    // loaders with equal options will share worker pools
    options: {
      // the number of spawned workers, defaults to (number of cpus - 1) or
      // fallback to 1 when require('os').cpus() is undefined
      workers: 2,

      // number of jobs a worker processes in parallel
      // defaults to 20
      workerParallelJobs: 50,

      // additional node.js arguments
      workerNodeArgs: ['--max-old-space-size=1024'],

      // Allow to respawn a dead worker pool
      // respawning slows down the entire compilation
      // and should be set to false for development
      poolRespawn: false,

      // timeout for killing the worker processes when idle
      // defaults to 500 (ms)
      // can be set to Infinity for watching builds to keep workers alive
      poolTimeout: 2000,

      // number of jobs the poll distributes to the workers
      // defaults to 200
      // decrease of less efficient but more fair distribution
      poolParallelJobs: 50,

      // name of the pool
      // can be used to create different pools with elsewise identical options
      name: 'my-pool',
    },
  },
  // your expensive loader (e.g babel-loader)
];
```

**prewarming**

To prevent the high delay when booting workers it possible to warmup the worker pool.

This boots the max number of workers in the pool and loads specified modules into the node.js module cache.

```js
const threadLoader = require('thread-loader');

threadLoader.warmup(
  {
    // pool options, like passed to loader options
    // must match loader options to boot the correct pool
  },
  [
    // modules to load
    // can be any module, i. e.
    'babel-loader',
    'babel-preset-es2015',
    'sass-loader',
  ]
);
```

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/thread-loader.svg
[npm-url]: https://npmjs.com/package/thread-loader
[node]: https://img.shields.io/node/v/thread-loader.svg
[node-url]: https://nodejs.org
[deps]: https://david-dm.org/webpack-contrib/thread-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/thread-loader
[tests]: https://github.com/webpack-contrib/thread-loader/workflows/thread-loader/badge.svg
[tests-url]: https://github.com/webpack-contrib/thread-loader/actions
[cover]: https://codecov.io/gh/webpack-contrib/thread-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/thread-loader
[chat]: https://badges.gitter.im/webpack/webpack.svg
[chat-url]: https://gitter.im/webpack/webpack
[size]: https://packagephobia.now.sh/badge?p=thread-loader
[size-url]: https://packagephobia.now.sh/result?p=thread-loader

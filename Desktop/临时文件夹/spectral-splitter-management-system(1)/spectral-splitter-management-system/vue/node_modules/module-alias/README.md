# module-alias
[![NPM Version][npm-image]][npm-url]

If everyone who reads this would donate just $1, I would be a millionaire in 1 week! 🙃 Thank you for reaching 1M+ weekly downloads!

More donations means more motivation for me to make updates. Thank you so much!

[DONATE $1 ❤️](https://tinyurl.com/donate-module-alias)

---

Create aliases of directories and register custom module paths in NodeJS like a boss!

No more shit-coding paths in Node like so:

```js
require('../../../../some/very/deep/module')
```
Enough of this madness!

Just create an alias and do it the right way:

```js
var module = require('@deep/module')
// Or ES6
import module from '@deep/module'
```

It also allows you to register directories that will act just like `node_modules` but with your own private modules, so that you can access them directly:

```js
require('my_private_module');
// Or ES6
import module from 'my_private_module'
```

**WARNING:** If you are going to use this package within another NPM package, please read [Using within another NPM package](#using-within-another-npm-package) first to be aware of potential caveats.

## Install

```
npm i --save module-alias
```

## Usage

Add your custom configuration to your `package.json` (in your application's root)

```js
// Aliases
"_moduleAliases": {
  "@root"      : ".", // Application's root
  "@deep"      : "src/some/very/deep/directory/or/file",
  "@my_module" : "lib/some-file.js",
  "something"  : "src/foo", // Or without @. Actually, it could be any string
}

// Custom module directories, just like `node_modules` but with your private modules (optional)
"_moduleDirectories": ["node_modules_custom"],
```

Then add this line at the very main file of your app, before any code

```js
require('module-alias/register')
```

**And you're all set!** Now you can do stuff like:

```js
require('something')
const module = require('@root/some-module')
const veryDeepModule = require('@deep/my-module')
const customModule = require('my_private_module') // module from `node_modules_custom` directory

// Or ES6
import 'something'
import module from '@root/some-module'
import veryDeepModule from '@deep/my-module'
import customModule from 'my_private_module' // module from `node_modules_custom` directory
```

## Advanced usage

If you don't want to modify your `package.json` or you just prefer to set it all up programmatically, then the following methods are available for you:

* `addAlias('alias', 'target_path')` - register a single alias
* `addAliases({ 'alias': 'target_path', ... }) ` - register multiple aliases
* `addPath(path)` - Register custom modules directory (like node_modules, but with your own modules)

_Examples:_
```js
const moduleAlias = require('module-alias')

//
// Register alias
//
moduleAlias.addAlias('@client', __dirname + '/src/client')

// Or multiple aliases
moduleAlias.addAliases({
  '@root'  : __dirname,
  '@client': __dirname + '/src/client',
  ...
})

// Custom handler function (starting from v2.1)
moduleAlias.addAlias('@src', (fromPath, request, alias) => {
  // fromPath - Full path of the file from which `require` was called
  // request - The path (first argument) that was passed into `require`
  // alias - The same alias that was passed as first argument to `addAlias` (`@src` in this case)

  // Return any custom target path for the `@src` alias depending on arguments
  if (fromPath.startsWith(__dirname + '/others')) return __dirname + '/others'
  return __dirname + '/src'
})

//
// Register custom modules directory
//
moduleAlias.addPath(__dirname + '/node_modules_custom')
moduleAlias.addPath(__dirname + '/src')

//
// Import settings from a specific package.json
//
moduleAlias(__dirname + '/package.json')

// Or let module-alias to figure where your package.json is
// located. By default it will look in the same directory
// where you have your node_modules (application's root)
moduleAlias()
```

## Usage with WebPack

Luckily, WebPack has a built in support for aliases and custom modules directories so it's easy to make it work on the client side as well!

```js
// webpack.config.js
const npm_package = require('./package.json')

module.exports = {
  entry: { ... },
  resolve: {
    root: __dirname,
    alias: npm_package._moduleAliases || {},
    modules: npm_package._moduleDirectories || [] // eg: ["node_modules", "node_modules_custom", "src"]
  }
}
```

More details on the [official documentation](https://webpack.js.org/configuration/resolve).

## Usage with Jest

Unfortunately, `module-alias` itself would not work from Jest due to a custom behavior of Jest's `require`. But you can use it's own aliasing mechanism instead. The configuration can be defined either in `package.json` or `jest.config.js`. The example below is for `package.json`:

```js
"jest": {
  "moduleNameMapper": {
    "@root/(.*)": "<rootDir>/$1",
    "@client/(.*)": "<rootDir>/src/client/$1"
  },
}
```

More details on the [official documentation](https://jestjs.io/docs/en/configuration#modulenamemapper-objectstring-string--arraystring).

## Using within another NPM package

You can use `module-alias` within another NPM package, however there are a few things to take into consideration.

1. As the aliases are global, you should make sure your aliases are unique, to avoid conflicts with end-user code, or with other libraries using module-alias. For example, you could prefix your aliases with '@my-lib/', and then use require('@my-lib/deep').
2. The internal "register" mechanism may not work, you should not rely on `require('module-alias/register')` for automatic detection of `package.json` location (where you defined your aliases), as it tries to find package.json in either the current working directory of your node process, or two levels down from node_modules/module-alias. It is extremely likely that this is end-user code. So, instead, your should either register aliases manually with `moduleAlias.addAlias`, or using something like `require('module-alias')(__dirname)`.

Here is an [example project](https://github.com/Kehrlann/module-alias-library).


## Known incompatibilities

This module does not play well with:

- Front-end JavaScript code. Module-alias is designed for server side so do not expect it to work with front-end frameworks (React, Vue, ...) as they tend to use Webpack. Use Webpack's [resolve.alias](https://webpack.js.org/configuration/resolve/#resolvealias) mechanism instead.
- [Jest](https://jestjs.io), which discards node's module system entirely to use it's own module system, bypassing module-alias.
- The [NCC compiler](https://github.com/zeit/ncc), as it uses WebPack under the hood without exposing properties, such as resolve.alias. It is not [something they wish to do](https://github.com/zeit/ncc/pull/460).

## How it works?

In order to register an alias it modifies the internal `Module._resolveFilename` method so that when you use `require` or `import` it first checks whether the given string starts with one of the registered aliases, if so, it replaces the alias in the string with the target path of the alias.

In order to register a custom modules path (`addPath`) it modifies the internal `Module._nodeModulePaths` method so that the given directory then acts like it's the `node_modules` directory.

## Refactor your code (for already existing projects)

If you are using this on an existing project, you can use [relative-to-alias](https://github.com/s-yadav/relative-to-alias) to refactor your code to start using aliases.

## Donate

If everyone who downloads module-alias would donate just $1, I would be a millionaire in 1 week!

I love contributing to open source, for free, but you know, sometimes, in the middle of the night, I may wan to eat.

There are some improvements planned for module-alias and your donations will help a lot to make it happen faster.

[DONATE $1 ❤️](https://tinyurl.com/donate-module-alias) and thank you so much!


[npm-image]: https://img.shields.io/npm/v/module-alias.svg
[npm-url]: https://npmjs.org/package/module-alias
[travis-image]: https://img.shields.io/travis/ilearnio/module-alias/master.svg
[travis-url]: https://travis-ci.org/ilearnio/module-alias


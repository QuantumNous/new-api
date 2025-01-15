Case Sensitive Paths - Webpack Plugin
==========

[![Build Status](https://travis-ci.org/Urthen/case-sensitive-paths-webpack-plugin.svg?branch=master)](https://travis-ci.org/Urthen/case-sensitive-paths-webpack-plugin)
[![Known Vulnerabilities](https://snyk.io/test/github/urthen/case-sensitive-paths-webpack-plugin/badge.svg?targetFile=package.json)](https://snyk.io/test/github/urthen/case-sensitive-paths-webpack-plugin?targetFile=package.json)
[![npm version](https://badge.fury.io/js/case-sensitive-paths-webpack-plugin.svg)](https://badge.fury.io/js/case-sensitive-paths-webpack-plugin)
[![npm downloads](https://img.shields.io/npm/dw/case-sensitive-paths-webpack-plugin.svg)](https://www.npmjs.com/package/case-sensitive-paths-webpack-plugin)
![bananas: ripe](https://img.shields.io/badge/bananas-ripe-yellow.svg)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FUrthen%2Fcase-sensitive-paths-webpack-plugin.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FUrthen%2Fcase-sensitive-paths-webpack-plugin?ref=badge_shield)

This Webpack plugin enforces the entire path of all required modules match the exact case of the actual path on disk.
Using this plugin helps alleviate cases where developers working on OSX, which does not follow strict path case sensitivity,
will cause conflicts with other developers or build boxes running other operating systems which require correctly cased paths.

[Previous](https://gist.github.com/Morhaus/333579c2a5b4db644bd50) [iterations](https://github.com/dcousineau/force-case-sensitivity-webpack-plugin) on this same idea provide the basis for this plugin, but unfortunately do not properly check case on
the entire path. This plugin fixes that. Example output:

> ERROR in ./src/containers/SearchProducts.js
  Module not found: Error: [CaseSensitivePathsPlugin] `/Users/example/yourproject/src/components/searchProducts/searchproducts.js` does not match the corresponding path on disk `/Users/example/yourproject/src/components/searchproducts`
   @ ./src/containers/SearchProducts.js 9:22-84

Install
----
    npm install --save-dev case-sensitive-paths-webpack-plugin

Usage
----

```JavaScript
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

var webpackConfig = {
    plugins: [
        new CaseSensitivePathsPlugin()
        // other plugins ...
    ]
    // other webpack config ...
}
```

Want more information? Pass ```{debug: true}``` to the plugin like so:

```JavaScript
new CaseSensitivePathsPlugin({debug: true})
```

It will output every directory it reads, as well as a sum total of filesystem operations.
This is mostly useful for internal debugging of the plugin, but if you find it useful, more power to you.

Demo
---
Check the `/demo` directory for a working example of the plugin in action, with tests demonstrating the effect of the plugin. See `/demo/README.md` for more.

Thanks & Credit
----
* [Daniel Cousineau](https://github.com/dcousineau) who wrote an [earlier version](https://github.com/dcousineau/force-case-sensitivity-webpack-plugin) of this case-sensitivity plugin
* [Alexandre Kirszenberg](https://github.com/Morhaus) who's [gist](https://gist.github.com/Morhaus/333579c2a5b4db644bd5) formed the basis of both these plugins.
* [Cameron Brewer](https://github.com/morethanfire) and [Ben Collins](https://github.com/aggieben) who added Windows support.
* [Christian Lilley](https://github.com/xml) who added a demo/test package.
* [Lance Eastgate](https://github.com/NorwegianKiwi) who added some internationalization support
* [Jonathan Kim](https://github.com/jkimbo) and [Dan Abramov](https://github.com/gaearon) who investigated, fixed, and added some tests for a crashing bug.
* [Jason Quense](https://github.com/jquense) who switched it to properly use the webpack-provided fs object.
* [Cesare Soldini](https://github.com/caesarsol) who added a test
* [Kirill Konshin](https://github.com/kirill-konshin) who helped update to Webpack 5


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FUrthen%2Fcase-sensitive-paths-webpack-plugin.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FUrthen%2Fcase-sensitive-paths-webpack-plugin?ref=badge_large)

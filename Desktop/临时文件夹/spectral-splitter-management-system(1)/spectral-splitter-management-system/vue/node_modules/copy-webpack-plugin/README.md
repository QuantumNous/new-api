<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200"
      src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![cover][cover]][cover-url]
[![chat][chat]][chat-url]
[![size][size]][size-url]

# copy-webpack-plugin

Copies individual files or entire directories, which already exist, to the build directory.

## Getting Started

To begin, you'll need to install `copy-webpack-plugin`:

```console
npm install copy-webpack-plugin --save-dev
```

Then add the plugin to your `webpack` config. For example:

**webpack.config.js**

```js
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "source", to: "dest" },
        { from: "other", to: "public" },
      ],
    }),
  ],
};
```

> ℹ️ `copy-webpack-plugin` is not designed to copy files generated from the build process; rather, it is to copy files that already exist in the source tree, as part of the build process.

> ℹ️ If you want `webpack-dev-server` to write files to the output directory during development, you can force it with the [`writeToDisk`](https://github.com/webpack/webpack-dev-middleware#writetodisk) option or the [`write-file-webpack-plugin`](https://github.com/gajus/write-file-webpack-plugin).

> ℹ️ You can get the original source filename from [Asset Objects](https://webpack.js.org/api/stats/#asset-objects).

## Options

|            Name             |           Type            | Description                              |
| :-------------------------: | :-----------------------: | :--------------------------------------- |
| **[`patterns`](#patterns)** | `{Array<String\|Object>}` | Specify file related patterns for plugin |
| **[`options`](#options-1)** |        `{Object}`         | Specify options for plugin               |

The plugin's signature:

**webpack.config.js**

```js
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "source", to: "dest" },
        { from: "other", to: "public" },
      ],
      options: {
        concurrency: 100,
      },
    }),
  ],
};
```

### Patterns

|                  Name                   |         Type         |                     Default                     | Description                                                                                                                                            |
| :-------------------------------------: | :------------------: | :---------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
|             [`from`](#from)             |      `{String}`      |                   `undefined`                   | Glob or path from where we copy files.                                                                                                                 |
|               [`to`](#to)               | `{String\|Function}` |            `compiler.options.output`            | Output path.                                                                                                                                           |
|          [`context`](#context)          |      `{String}`      | `options.context \|\| compiler.options.context` | A path that determines how to interpret the `from` path.                                                                                               |
|      [`globOptions`](#globoptions)      |      `{Object}`      |                   `undefined`                   | [Options][glob-options] passed to the glob pattern matching library including `ignore` option.                                                         |
|           [`filter`](#filter)           |     `{Function}`     |                   `undefined`                   | Allows to filter copied assets.                                                                                                                        |
|           [`toType`](#totype)           |      `{String}`      |                   `undefined`                   | Determinate what is `to` option - directory, file or template.                                                                                         |
|            [`force`](#force)            |     `{Boolean}`      |                     `false`                     | Overwrites files already in `compilation.assets` (usually added by other plugins/loaders).                                                             |
|         [`priority`](#priority)         |      `{Number}`      |                       `0`                       | Allows you to specify the copy priority.                                                                                                               |
|        [`transform`](#transform)        |      `{Object}`      |                   `undefined`                   | Allows to modify the file contents. Enable `transform` caching. You can use `{ transform: {cache: { key: 'my-cache-key' }} }` to invalidate the cache. |
|     [`transformAll`](#transformAll)     |     `{Function}`     |                   `undefined`                   | Allows you to modify the contents of multiple files and save the result to one file.                                                                   |
| [`noErrorOnMissing`](#noerroronmissing) |     `{Boolean}`      |                     `false`                     | Doesn't generate an error on missing file(s).                                                                                                          |
|             [`info`](#info)             | `{Object\|Function}` |                   `undefined`                   | Allows to add assets info.                                                                                                                             |

#### `from`

Type: `String`
Default: `undefined`

Glob or path from where we copy files.
Globs accept [fast-glob pattern-syntax](https://github.com/mrmlnc/fast-glob#pattern-syntax).
Glob can only be a `string`.

> ⚠️ Don't use directly `\\` in `from` option if it is a `glob` (i.e `path\to\file.ext`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/`.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        "relative/path/to/file.ext",
        "relative/path/to/dir",
        path.resolve(__dirname, "src", "file.ext"),
        path.resolve(__dirname, "src", "dir"),
        "**/*",
        {
          from: "**/*",
        },
        // If absolute path is a `glob` we replace backslashes with forward slashes, because only forward slashes can be used in the `glob`
        path.posix.join(
          path.resolve(__dirname, "src").replace(/\\/g, "/"),
          "*.txt"
        ),
      ],
    }),
  ],
};
```

##### `For windows`

If you define `from` as absolute file path or absolute folder path on `Windows`, you can use windows path segment (`\\`)

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "file.txt"),
        },
      ],
    }),
  ],
};
```

But you should always use forward-slashes in `glob` expressions
See [fast-glob manual](https://github.com/mrmlnc/fast-glob#how-to-write-patterns-on-windows).

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          // If absolute path is a `glob` we replace backslashes with forward slashes, because only forward slashes can be used in the `glob`
          from: path.posix.join(
            path.resolve(__dirname, "fixtures").replace(/\\/g, "/"),
            "*.txt"
          ),
        },
      ],
    }),
  ],
};
```

The `context` behaves differently depending on what the `from` is (`glob`, `file` or `dir`).
More [`examples`](#examples)

#### `to`

Type: `String|Function`
Default: `compiler.options.output`

##### String

Output path.

> ⚠️ Don't use directly `\\` in `to` (i.e `path\to\dest`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "**/*",
          to: "relative/path/to/dest/",
        },
        {
          from: "**/*",
          to: "/absolute/path/to/dest/",
        },
        {
          from: "**/*",
          to: "[path][name].[contenthash][ext]",
        },
      ],
    }),
  ],
};
```

##### Function

Allows to modify the writing path.

> ⚠️ Don't return directly `\\` in `to` (i.e `path\to\newFile`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to({ context, absoluteFilename }) {
            return "dest/newPath/[name][ext]";
          },
        },
      ],
    }),
  ],
};
```

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to({ context, absoluteFilename }) {
            return Promise.resolve("dest/newPath/[name][ext]");
          },
        },
      ],
    }),
  ],
};
```

#### `context`

Type: `String`
Default: `options.context|compiler.options.context`

A path that determines how to interpret the `from` path.

> ⚠️ Don't use directly `\\` in `context` (i.e `path\to\context`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.txt",
          to: "dest/",
          context: "app/",
        },
      ],
    }),
  ],
};
```

The `context` option can be an absolute or relative path. If `context` is a relative, then it is converted to absolute based to `compiler.options.context`

Also, `context` indicates how to interpret the search results. Further, he is considered in this role.

To determine the structure from which the found resources will be copied to the destination folder, the `context` option is used.

If `from` is a file, then `context` is equal to the directory in which this file is located. Accordingly, the result will be only the file name.

If `from` is a directory, then `context` is the same as `from` and is equal to the directory itself. In this case, the result will be a hierarchical structure of the found folders and files relative to the specified directory.

If `from` is a glob, then regardless of the `context` option, the result will be the structure specified in the `from` option

More [`examples`](#examples)

#### `globOptions`

Type: `Object`
Default: `undefined`

Allows to configure the glob pattern matching library used by the plugin. [See the list of supported options][glob-options]
To exclude files from the selection, you should use [globOptions.ignore option](https://github.com/mrmlnc/fast-glob#ignore)

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "public/**/*",
          globOptions: {
            dot: true,
            gitignore: true,
            ignore: ["**/file.*", "**/ignored-directory/**"],
          },
        },
      ],
    }),
  ],
};
```

#### `filter`

Type: `Function`
Default: `undefined`

> ℹ️ To ignore files by path please use the [`globOptions.ignore`](#globoptions) option.

**webpack.config.js**

```js
const fs = require("fs").promise;

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "public/**/*",
          filter: async (resourcePath) => {
            const data = await fs.promises.readFile(resourcePath);
            const content = data.toString();

            if (content === "my-custom-content") {
              return false;
            }

            return true;
          },
        },
      ],
    }),
  ],
};
```

#### `toType`

Type: `String`
Default: `undefined`

Determinate what is `to` option - directory, file or template.
Sometimes it is hard to say what is `to`, example `path/to/dir-with.ext`.
If you want to copy files in directory you need use `dir` option.
We try to automatically determine the `type` so you most likely do not need this option.

|             Name              |    Type    |   Default   | Description                                                                                          |
| :---------------------------: | :--------: | :---------: | :--------------------------------------------------------------------------------------------------- |
|      **[`'dir'`](#dir)**      | `{String}` | `undefined` | If `to` has no extension or ends on `'/'`                                                            |
|     **[`'file'`](#file)**     | `{String}` | `undefined` | If `to` is not a directory and is not a template                                                     |
| **[`'template'`](#template)** | `{String}` | `undefined` | If `to` contains [a template pattern](https://webpack.js.org/configuration/output/#template-strings) |

##### `'dir'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "path/to/file.txt",
          to: "directory/with/extension.ext",
          toType: "dir",
        },
      ],
    }),
  ],
};
```

##### `'file'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "path/to/file.txt",
          to: "file/without/extension",
          toType: "file",
        },
      ],
    }),
  ],
};
```

##### `'template'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/",
          to: "dest/[name].[contenthash][ext]",
          toType: "template",
        },
      ],
    }),
  ],
};
```

#### `force`

Type: `Boolean`
Default: `false`

Overwrites files already in `compilation.assets` (usually added by other plugins/loaders).

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/**/*",
          to: "dest/",
          force: true,
        },
      ],
    }),
  ],
};
```

#### `priority`

Type: `Number`
Default: `0`

Allows to specify the priority of copying files with the same destination name.
Files for patterns with higher priority will be copied later.
To overwrite files, the [`force`](#force) option must be enabled.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copied second and will overwrite "dir_2/file.txt"
        {
          from: "dir_1/file.txt",
          to: "newfile.txt",
          force: true,
          priority: 10,
        },
        // Copied first
        {
          from: "dir_2/file.txt",
          to: "newfile.txt",
          priority: 5,
        },
      ],
    }),
  ],
};
```

#### `transform`

Type: `Function|Object`
Default: `undefined`

Allows to modify the file contents.

##### `Function`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          // The `content` argument is a [`Buffer`](https://nodejs.org/api/buffer.html) object, it could be converted to a `String` to be processed using `content.toString()`
          // The `absoluteFrom` argument is a `String`, it is absolute path from where the file is being copied
          transform(content, absoluteFrom) {
            return optimize(content);
          },
        },
      ],
    }),
  ],
};
```

##### `Object`

|               Name                |        Type         |   Default   | Description                                                                                                      |
| :-------------------------------: | :-----------------: | :---------: | :--------------------------------------------------------------------------------------------------------------- |
| **[`transformer`](#transformer)** |    `{Function}`     | `undefined` | Allows to modify the file contents.                                                                              |
|       **[`cache`](#cache)**       | `{Boolean\|Object}` |   `false`   | Enable `transform` caching. You can use `transform: { cache: { key: 'my-cache-key' } }` to invalidate the cache. |

###### `transformer`

Type: `Function`
Default: `undefined`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          // The `content` argument is a [`Buffer`](https://nodejs.org/api/buffer.html) object, it could be converted to a `String` to be processed using `content.toString()`
          // The `absoluteFrom` argument is a `String`, it is absolute path from where the file is being copied
          transform: {
            transformer(content, absoluteFrom) {
              return optimize(content);
            },
          },
        },
      ],
    }),
  ],
};
```

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          transform: {
            transformer(content, path) {
              return Promise.resolve(optimize(content));
            },
          },
        },
      ],
    }),
  ],
};
```

###### `cache`

Type: `Boolean|Object`
Default: `false`

**webpack.config.js**

Enable/disable and configure caching.
Default path to cache directory: `node_modules/.cache/copy-webpack-plugin`.

###### `Boolean`

Enables/Disable `transform` caching.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          transform: {
            transformer(content, path) {
              return optimize(content);
            },
            cache: true,
          },
        },
      ],
    }),
  ],
};
```

##### `Object`

Enables `transform` caching and setup cache directory and invalidation keys.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          transform: {
            transformer(content, path) {
              return optimize(content);
            },
            cache: {
              directory: path.resolve(__dirname, "cache-directory"),
              keys: {
                // May be useful for invalidating cache based on external values
                // For example, you can invalid cache based on `process.version` - { node: process.version }
                key: "value",
              },
            },
          },
        },
      ],
    }),
  ],
};
```

You can setup invalidation keys using a function.

Simple function:

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          transform: {
            transformer(content, path) {
              return optimize(content);
            },
            cache: {
              directory: path.resolve(__dirname, "cache-directory"),
              keys: (defaultCacheKeys, absoluteFrom) => {
                const keys = getCustomCacheInvalidationKeysSync();

                return {
                  ...defaultCacheKeys,
                  keys,
                };
              },
            },
          },
        },
      ],
    }),
  ],
};
```

Async function:

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/*.png",
          to: "dest/",
          transform: {
            transformer(content, path) {
              return optimize(content);
            },
            cache: {
              directory: path.resolve(__dirname, "cache-directory"),
              keys: async (defaultCacheKeys, absoluteFrom) => {
                const keys = await getCustomCacheInvalidationKeysAsync();

                return {
                  ...defaultCacheKeys,
                  keys,
                };
              },
            },
          },
        },
      ],
    }),
  ],
};
```

#### `transformAll`

Type: `Function`
Default: `undefined`

Allows you to modify the contents of multiple files and save the result to one file.

> ℹ️ The `to` option must be specified and point to a file. It is allowed to use only `[contenthash]` and `[fullhash]` template strings.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/**/*.txt",
          to: "dest/file.txt",
          // The `assets` argument is an assets array for the pattern.from ("src/**/*.txt")
          transformAll(assets) {
            const result = assets.reduce((accumulator, asset) => {
              // The asset content can be obtained from `asset.source` using `source` method.
              // The asset content is a [`Buffer`](https://nodejs.org/api/buffer.html) object, it could be converted to a `String` to be processed using `content.toString()`
              const content = asset.data;

              accumulator = `${accumulator}${content}\n`;
              return accumulator;
            }, "");

            return result;
          },
        },
      ],
    }),
  ],
};
```

### `noErrorOnMissing`

Type: `Boolean`
Default: `false`

Doesn't generate an error on missing file(s).

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "missing-file.txt"),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};
```

#### `info`

Type: `Object|Function<Object>`
Default: `undefined`

Allows to add assets info.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        "relative/path/to/file.ext",
        {
          from: "**/*",
          // Terser skip this file for minimization
          info: { minimized: true },
        },
      ],
    }),
  ],
};
```

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        "relative/path/to/file.ext",
        {
          from: "**/*",
          // Terser skip this file for minimization
          info: (file) => ({ minimized: true }),
        },
      ],
    }),
  ],
};
```

### Options

|             Name              |    Type    | Default | Description                                      |
| :---------------------------: | :--------: | :-----: | :----------------------------------------------- |
| [`concurrency`](#concurrency) | `{Number}` |  `100`  | Limits the number of simultaneous requests to fs |

#### `concurrency`

limits the number of simultaneous requests to fs

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [...patterns],
      options: { concurrency: 50 },
    }),
  ],
};
```

### Examples

#### Different variants `from` (`glob`, `file` or `dir`).

Take for example the following file structure:

```
src/directory-nested/deep-nested/deepnested-file.txt
src/directory-nested/nested-file.txt
```

##### From is a Glob

Everything that you specify in `from` will be included in the result:

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/directory-nested/**/*",
        },
      ],
    }),
  ],
};
```

Result:

```txt
src/directory-nested/deep-nested/deepnested-file.txt,
src/directory-nested/nested-file.txt
```

If you want only content `src/directory-nested/`, you should only indicate `glob` in `from`. The path to the folder in which the search should take place, should be moved to `context`.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "**/*",
          context: path.resolve(__dirname, "src", "directory-nested"),
        },
      ],
    }),
  ],
};
```

Result:

```txt
deep-nested/deepnested-file.txt,
nested-file.txt
```

##### From is a Dir

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "src", "directory-nested"),
        },
      ],
    }),
  ],
};
```

Result:

```txt
deep-nested/deepnested-file.txt,
nested-file.txt
```

Technically, this is `**/*` with a predefined context equal to the specified directory.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "**/*",
          context: path.resolve(__dirname, "src", "directory-nested"),
        },
      ],
    }),
  ],
};
```

Result:

```txt
deep-nested/deepnested-file.txt,
nested-file.txt
```

##### From is a File

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            "src",
            "directory-nested",
            "nested-file.txt"
          ),
        },
      ],
    }),
  ],
};
```

Result:

```txt
nested-file.txt
```

Technically, this is a filename with a predefined context equal to `path.dirname(pathToFile)`.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "nested-file.txt",
          context: path.resolve(__dirname, "src", "directory-nested"),
        },
      ],
    }),
  ],
};
```

Result:

```txt
nested-file.txt
```

#### Ignoring files

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.posix.join(
            path.resolve(__dirname, "src").replace(/\\/g, "/"),
            "**/*"
          ),
          globOptions: {
            ignore: [
              // Ignore all `txt` files
              "**/*.txt",
              // Ignore all files in all subdirectories
              "**/subdir/**",
            ],
          },
        },
      ],
    }),
  ],
};
```

#### Flatten copy

Removes all directory references and only copies file names.

> ⚠️ If files have the same name, the result is non-deterministic.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/**/*",
          to: "[name][ext]",
        },
      ],
    }),
  ],
};
```

Result:

```txt
file-1.txt
file-2.txt
nested-file.txt
```

#### Copy in new directory

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          // When copying files starting with a dot, must specify the toType option
          // toType: "file",
          to({ context, absoluteFilename }) {
            return `newdirectory/${path.relative(context, absoluteFilename)}`;
          },
          from: "directory",
        },
      ],
    }),
  ],
};
```

Result:

```txt
"newdirectory/file-1.txt",
"newdirectory/nestedfile.txt",
"newdirectory/nested/deep-nested/deepnested.txt",
"newdirectory/nested/nestedfile.txt",
```

#### Skip running JavaScript files through a minimizer

Useful if you need to simply copy `*.js` files to destination "as is" without evaluating and minimizing them using Terser.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        "relative/path/to/file.ext",
        {
          from: "**/*",
          // Terser skip this file for minimization
          info: { minimized: true },
        },
      ],
    }),
  ],
};
```

##### `yarn workspaces` and `monorepos`

When using `yarn workspaces` or` monorepos`, relative copy paths from node_modules can be broken due to the way packages are hoisting.
To avoid this, should explicitly specify where to copy the files from using `require.resolve`.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: `${path.dirname(
            require.resolve(`${moduleName}/package.json`)
          )}/target`,
          to: "target",
        },
      ],
    }),
  ],
};
```

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/copy-webpack-plugin.svg
[npm-url]: https://npmjs.com/package/copy-webpack-plugin
[node]: https://img.shields.io/node/v/copy-webpack-plugin.svg
[node-url]: https://nodejs.org
[deps]: https://david-dm.org/webpack-contrib/copy-webpack-plugin.svg
[deps-url]: https://david-dm.org/webpack-contrib/copy-webpack-plugin
[tests]: https://github.com/webpack-contrib/copy-webpack-plugin/workflows/copy-webpack-plugin/badge.svg
[tests-url]: https://github.com/webpack-contrib/copy-webpack-plugin/actions
[cover]: https://codecov.io/gh/webpack-contrib/copy-webpack-plugin/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/copy-webpack-plugin
[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack
[size]: https://packagephobia.now.sh/badge?p=copy-webpack-plugin
[size-url]: https://packagephobia.now.sh/result?p=copy-webpack-plugin
[glob-options]: https://github.com/sindresorhus/globby#options


# cli-highlight

> Syntax highlighting in your terminal

[![npm](https://img.shields.io/npm/v/cli-highlight.svg)](https://www.npmjs.com/package/cli-highlight)
[![downloads](https://img.shields.io/npm/dm/cli-highlight.svg)](https://www.npmjs.com/package/cli-highlight)
[![CI status](https://github.com/felixfbecker/cli-highlight/workflows/build/badge.svg?branch=main)](https://github.com/felixfbecker/cli-highlight/actions)
[![codecov](https://codecov.io/gh/felixfbecker/cli-highlight/branch/main/graph/badge.svg)](https://codecov.io/gh/felixfbecker/cli-highlight)
![node](http://img.shields.io/node/v/cli-highlight.svg)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![license](https://img.shields.io/npm/l/cli-highlight.svg)](https://github.com/felixfbecker/cli-highlight/blob/main/LICENSE.txt)

## Example

![Example Output](media/screenshot.svg)

## CLI Usage
Output a file
```sh
$ highlight package.json
```

Color output of another program with piping. Example: A database migration script that logs SQL Queries
```sh
$ db-migrate --dry-run | highlight
```

Command line options:
```html
Usage: highlight [options] [file]

Outputs a file or STDIN input with syntax highlighting

Options:
  --language, -l  Set the langugage explicitely
                  If omitted will try to auto-detect
  --theme, -t     Use a theme defined in a JSON file
  --version, -v   Show version number                                   [boolean]
  --help, -h      Show help                                             [boolean]
```

## Programmatic Usage

You can use this module programmatically to highlight logs of your Node app. Example:

```js
const highlight = require('cli-highlight').highlight
const Sequelize = require('sequelize')

const db = new Sequelize(process.env.DB, {
  logging(log) {
    console.log(highlight(log, {language: 'sql', ignoreIllegals: true}))
  }
})
```

Detailed API documenation can be found [here](http://cli-highlight.surge.sh/).

## Themes
You can write your own theme in a JSON file and pass it with `--theme`.
The key must be one of the [highlight.js CSS class names](http://highlightjs.readthedocs.io/en/latest/css-classes-reference.html) or `"default"`,
and the value must be one or an array of [Chalk styles](https://github.com/chalk/chalk#styles) to be applied to that token.

```json
{
  "keyword": "blue",
  "built_in": ["cyan", "dim"],
  "string": "red",
  "default": "gray"
}
```

The style for `"default"` will be applied to any substrings not handled by highlight.js. The specifics depend on the language but this typically includes things like commas in parameter lists, semicolons at the end of lines, etc.

The theme is combined with the [default theme](http://cli-highlight.surge.sh/globals.html#default_theme).
The default theme is still not colored a lot or optimized for many languages, PRs welcome!

## Supported Languages
[All languages of highlight.js](https://highlightjs.org/static/demo/) are supported.
Check a [CI build](https://travis-ci.org/felixfbecker/cli-highlight) for examples of all the different languages and their highlighting.

## Contributing
The module is written in TypeScript and can be compiled with `npm run build`.
`npm run watch` starts `tsc` in watch mode. Tests are written with mocha.

Improving language support is done by adding more colors to the tokens in the default theme and writing more tests.

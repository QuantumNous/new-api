# is-file-esm

> Determines whether a Node file is a Module (`import`) or a Script (`require`)

## Algorithm

Determining the module system of a file comes from three inputs, the `type` field 
of the closest `package.json` to that file, the file extension (`.js`, `.mjs` or `.cjs`)
and the lesser know `--input-type` command-line flag. The latter only applies to 
dyamic input (via STDIN, `--eval` or `--print` flags) so is not considered with this library.

So to determine whether a file is an esm file (e.g. native EcmaScript modules) or not,
we use the following procedure:

```
read package.json for "type" field,
  if type is "module"
    if answer.mjs -> module 
    if answer.js -> module
    if answer.cjs -> script
  if type is "commonjs"
    if answer.mjs -> module   
    if answer.js -> script
    if answer.cjs -> script
  if type is not set
    if answer.mjs -> module
    if answer.js -> script
    if answer.cjs -> script
```

## API

The `is-file-esm` module provides synchronous, awaitable (promise-based) and callback based APIs. 

In each case the Result object has the following shape: 

```js
{
  esm: Boolean, // true if file is a Module, false if it is a Script
  type: String,  // the determined package.json type, may be undefined, 'module', or 'commonjs'
  extType: String, // the file extension type, may be 'c', 'm' or 'j'
  path: String,  // the input path
  pkgPath: String // the path to the package.json from which the type was determined
}
```

### Awaitable (promise-based)

#### `await isFileEsm(path) => Result`

```js
  import isFileEsm from 'is-file-esm'
  const { esm, path } = await isFileEsm('/path/to/file.js')
  if (esm) console.log(`File ${path} is a Module`)
  else console.log(`File ${path} is a Script`)
```

### Callback-style

#### `isFileEsm(path, cb(err, Result))`

```js
  const isFileEsm = require('is-file-esm')
  isFileEsm('/path/to/file.js', (err,  result) => {
    if (err) {
      console.error(err)
      return
    }
    if (result.esm) console.log(`File ${result.path} is a Module`)
    else console.log(`File ${result.path} is a Script`)
  })
```

### Synchronous

#### `isFileEsm.sync(path) => Result`

```js
  import isFileEsm from 'is-file-esm'
  const { esm, path } = isFileEsm.sync('/path/to/file.js')
  if (esm) console.log(`File ${path} is a Module`)
  else console.log(`File ${path} is a Script`)
```

### Test

```sh
npm test
```

```
test/index.js ..................................... 213/213
total ............................................. 213/213

  213 passing (927.584ms)

  ok
----------|----------|----------|----------|----------|-------------------|
File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
----------|----------|----------|----------|----------|-------------------|
All files |      100 |      100 |      100 |      100 |                   |
 index.js |      100 |      100 |      100 |      100 |                   |
----------|----------|----------|----------|----------|-------------------|
```

### License

MIT
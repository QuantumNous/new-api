'use strict'
const { join } = require('path')
const { test } = require('tap')
const { when } = require('nonsynchronous')
const { chmodSync } = require('fs')
const isFileEsm = require('..')
const {
  ERR_PATH_MUST_BE_STRING,
  ERR_PATH_MUST_BE_ABSOLUTE,
  ERR_PATH_MUST_EXIST,
  ERR_PATH_MUST_HAVE_VALID_EXT
} = isFileEsm.constants

const ERR_BAD_TYPE = 'package.json type "bad" not recognized'
const ERR_PERMISSION_DENIED = /EACCES: permission denied/

const fixtures = join(__dirname, 'fixtures')

test('path must be string (promise)', async ({ rejects }) => {
  await rejects(() => isFileEsm(), Error(ERR_PATH_MUST_BE_STRING))
  await rejects(() => isFileEsm({}), Error(ERR_PATH_MUST_BE_STRING))
})

test('path must be absolute (promise)', async ({ rejects }) => {
  await rejects(() => isFileEsm('../foo.js'), Error(ERR_PATH_MUST_BE_ABSOLUTE))
  await rejects(() => isFileEsm('./bar/foo.mjs'), Error(ERR_PATH_MUST_BE_ABSOLUTE))
})

test('path must have ext (promise)', async ({ rejects }) => {
  await rejects(() => isFileEsm('/bar/foo'), Error(ERR_PATH_MUST_HAVE_VALID_EXT))
})

test('path must have valid ext (promise)', async ({ rejects }) => {
  await rejects(() => isFileEsm('/bar/foo.ext'), Error(ERR_PATH_MUST_HAVE_VALID_EXT))
})

test('path must exist (promise)', async ({ rejects }) => {
  await rejects(() => isFileEsm(join(fixtures, 'bar', 'foo.js')), Error(ERR_PATH_MUST_EXIST))
})

test('type-commonjs-cjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'c')
})

test('type-commonjs-js promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-commonjs-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'j')
})

test('type-commonjs-mjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'm')
})

test('type-module-cjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-module-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'c')
})

test('type-module-js promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-module-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'j')
})

test('type-module-mjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-module-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'm')
})

test('type-undefined-cjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'c')
})

test('type-undefined-js promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-undefined-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'j')
})

test('type-undefined-mjs promise', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = await isFileEsm(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'm')
})

test('type-bad-cjs promise', async ({ is, rejects }) => {
  const inputPath = join(fixtures, 'type-bad-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-bad-cjs', 'package.json')
  let error = null
  await rejects(async () => {
    try {
      await isFileEsm(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'c')
})

test('type-bad-js promise', async ({ is, rejects }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  let error = null
  await rejects(async () => {
    try {
      await isFileEsm(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'j')
})

test('type-bad-mjs promise', async ({ is, rejects }) => {
  const inputPath = join(fixtures, 'type-bad-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-bad-mjs', 'package.json')
  let error = null
  await rejects(async () => {
    try {
      await isFileEsm(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'm')
})

test('package.json read error propagation (promise)', async ({ rejects, tearDown }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  tearDown(() => chmodSync(expectedPkgPath, 0o644))
  chmodSync(expectedPkgPath, 0o000)
  await rejects(() => isFileEsm(inputPath), ERR_PERMISSION_DENIED)
})

test('type-commonjs-cjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'c')
})

test('type-commonjs-js sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-commonjs-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'j')
})

test('type-commonjs-mjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-commonjs-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'commonjs')
  is(extType, 'm')
})

test('type-module-cjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-module-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'c')
})

test('type-module-js sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-module-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'j')
})

test('type-module-mjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-module-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-module-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'module')
  is(extType, 'm')
})

test('type-undefined-cjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-cjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'c')
})

test('type-undefined-js sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-undefined-js', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, false)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'j')
})

test('type-undefined-mjs sync', async ({ is }) => {
  const inputPath = join(fixtures, 'type-undefined-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-mjs', 'package.json')
  const { esm, path, type, extType, pkgPath } = isFileEsm.sync(inputPath)
  is(esm, true)
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, undefined)
  is(extType, 'm')
})

test('path must be string (sync)', async ({ throws }) => {
  throws(() => isFileEsm.sync(), Error(ERR_PATH_MUST_BE_STRING))
  throws(() => isFileEsm.sync({}), Error(ERR_PATH_MUST_BE_STRING))
})

test('path must be absolute (sync)', async ({ throws }) => {
  throws(() => isFileEsm.sync('../foo.js'), Error(ERR_PATH_MUST_BE_ABSOLUTE))
  throws(() => isFileEsm.sync('./bar/foo.mjs'), Error(ERR_PATH_MUST_BE_ABSOLUTE))
})

test('path must have ext (sync)', async ({ throws }) => {
  throws(() => isFileEsm.sync('/bar/foo'), Error(ERR_PATH_MUST_HAVE_VALID_EXT))
})

test('path must have valid ext (sync)', async ({ throws }) => {
  throws(() => isFileEsm.sync('/bar/foo.ext'), Error(ERR_PATH_MUST_HAVE_VALID_EXT))
})

test('path must exist (promise)', async ({ throws }) => {
  throws(() => isFileEsm.sync(join(fixtures, 'bar', 'foo.js')), Error(ERR_PATH_MUST_EXIST))
})

test('type-bad-cjs sync', async ({ is, throws }) => {
  const inputPath = join(fixtures, 'type-bad-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-bad-cjs', 'package.json')
  let error = null
  throws(() => {
    try {
      isFileEsm.sync(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'c')
})

test('type-bad-js sync', async ({ is, throws }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  let error = null
  throws(() => {
    try {
      isFileEsm.sync(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'j')
})

test('type-bad-mjs sync', async ({ is, throws }) => {
  const inputPath = join(fixtures, 'type-bad-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-bad-mjs', 'package.json')
  let error = null
  throws(() => {
    try {
      isFileEsm.sync(inputPath)
    } catch (err) {
      error = err
      throw err
    }
  }, ERR_BAD_TYPE)
  const { path, type, extType, pkgPath } = error.meta
  is(path, inputPath)
  is(expectedPkgPath, pkgPath)
  is(type, 'bad')
  is(extType, 'm')
})

test('package.json read error propagation (sync)', async ({ throws, tearDown }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  tearDown(() => chmodSync(expectedPkgPath, 0o644))
  chmodSync(expectedPkgPath, 0o000)
  throws(() => isFileEsm.sync(inputPath), ERR_PERMISSION_DENIED)
})

test('type-commonjs-cjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-commonjs-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-cjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, false)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'commonjs')
    is(extType, 'c')
    until()
  })
  await until.done()
})

test('type-commonjs-js callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-commonjs-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-commonjs-js', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, false)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'commonjs')
    is(extType, 'j')
    until()
  })
  await until.done()
})

test('type-commonjs-mjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-commonjs-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-commonjs-mjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, true)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'commonjs')
    is(extType, 'm')
    until()
  })
  await until.done()
})

test('type-module-cjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-module-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-module-cjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, false)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'module')
    is(extType, 'c')
    until()
  })
  await until.done()
})

test('type-module-js callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-module-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-module-js', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, true)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'module')
    is(extType, 'j')
    until()
  })
  await until.done()
})

test('type-module-mjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-module-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-module-mjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, true)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'module')
    is(extType, 'm')
    until()
  })
  await until.done()
})

test('type-undefined-cjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-undefined-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-cjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, false)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, undefined)
    is(extType, 'c')
    until()
  })
  await until.done()
})

test('type-undefined-js callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-undefined-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-undefined-js', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, false)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, undefined)
    is(extType, 'j')
    until()
  })
  await until.done()
})

test('type-undefined-mjs callback', async ({ is, error }) => {
  const inputPath = join(fixtures, 'type-undefined-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-undefined-mjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err, { esm, path, type, extType, pkgPath }) => {
    error(err)
    is(esm, true)
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, undefined)
    is(extType, 'm')
    until()
  })
  await until.done()
})

test('path must be string (callback)', async ({ match }) => {
  const until1 = when()
  isFileEsm(undefined, (err) => {
    match(err, Error(ERR_PATH_MUST_BE_STRING))
    until1()
  })
  const until2 = when()
  isFileEsm({}, (err) => {
    match(err, Error(ERR_PATH_MUST_BE_STRING))
    until2()
  })
  await Promise.all([until1.done(), until2.done()])
})

test('path must be absolute (callback)', async ({ match }) => {
  const until1 = when()
  isFileEsm('../foo.js', (err) => {
    match(err, Error(ERR_PATH_MUST_BE_ABSOLUTE))
    until1()
  })
  const until2 = when()
  isFileEsm('./bar/foo.mjs', (err) => {
    match(err, Error(ERR_PATH_MUST_BE_ABSOLUTE))
    until2()
  })
  await Promise.all([until1.done(), until2.done()])
})

test('path must have ext (callback)', async ({ match }) => {
  const until = when()
  isFileEsm('/bar/foo', (err) => {
    match(err, Error(ERR_PATH_MUST_HAVE_VALID_EXT))
    until()
  })
  await until.done()
})

test('path must have valid ext (callback)', async ({ match }) => {
  const until = when()
  isFileEsm('/bar/foo.ext', (err) => {
    match(err, Error(ERR_PATH_MUST_HAVE_VALID_EXT))
    until()
  })
  await until.done()
})

test('path must exist (callback)', async ({ match }) => {
  const until = when()
  isFileEsm(join(fixtures, 'bar', 'foo.js'), (err) => {
    match(err, Error(ERR_PATH_MUST_EXIST))
    until()
  })
  await until.done()
})

test('type-bad-cjs callback', async ({ is }) => {
  const inputPath = join(fixtures, 'type-bad-cjs', 'file.cjs')
  const expectedPkgPath = join(fixtures, 'type-bad-cjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err) => {
    is(err.message, ERR_BAD_TYPE)
    const { path, type, extType, pkgPath } = err.meta
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'bad')
    is(extType, 'c')
    until()
  })
  await until.done()
})

test('type-bad-js callback', async ({ is }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err) => {
    is(err.message, ERR_BAD_TYPE)
    const { path, type, extType, pkgPath } = err.meta
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'bad')
    is(extType, 'j')
    until()
  })
  await until.done()
})

test('type-bad-mjs callback', async ({ is }) => {
  const inputPath = join(fixtures, 'type-bad-mjs', 'file.mjs')
  const expectedPkgPath = join(fixtures, 'type-bad-mjs', 'package.json')
  const until = when()
  isFileEsm(inputPath, (err) => {
    is(err.message, ERR_BAD_TYPE)
    const { path, type, extType, pkgPath } = err.meta
    is(path, inputPath)
    is(expectedPkgPath, pkgPath)
    is(type, 'bad')
    is(extType, 'm')
    until()
  })
  await until.done()
})

test('package.json read error propagation (callback)', async ({ match, tearDown }) => {
  const inputPath = join(fixtures, 'type-bad-js', 'file.js')
  const expectedPkgPath = join(fixtures, 'type-bad-js', 'package.json')
  tearDown(() => chmodSync(expectedPkgPath, 0o644))
  chmodSync(expectedPkgPath, 0o000)
  const until = when()
  isFileEsm(inputPath, (err) => {
    match(err, ERR_PERMISSION_DENIED)
    until()
  })
  await until.done()
})

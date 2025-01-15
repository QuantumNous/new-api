'use strict'
const { extname, isAbsolute, dirname } = require('path')
const { access, accessSync, constants: { F_OK } } = require('fs')
const { promisify, callbackify } = require('util')
const readPkgUp = callbackify(require('read-pkg-up'))

const isFileEsmPromise = promisify(isFileEsm)

const tick = queueMicrotask

const ERR_PATH_MUST_BE_STRING = 'is-esm: path must be a string'
const ERR_PATH_MUST_BE_ABSOLUTE = 'is-esm: absolute paths only'
const ERR_PATH_MUST_EXIST = 'is-esm: path does not exist'
const ERR_PATH_MUST_HAVE_VALID_EXT = 'is-esm: path must be to a file with an extension of .js, .mjs or .cjs'

function isFileEsm (path, cb) {
  if (arguments.length <= 1) return isFileEsmPromise(path)
  if (typeof path !== 'string') return void tick(() => cb(Error(ERR_PATH_MUST_BE_STRING)))
  if (isAbsolute(path) === false) return void tick(() => cb(Error(ERR_PATH_MUST_BE_ABSOLUTE)))
  const extMatch = /\.(c|m)?js/.exec(extname(path))
  if (extMatch === null) return void tick(() => cb(Error(ERR_PATH_MUST_HAVE_VALID_EXT)))
  access(path, F_OK, (err) => {
    if (err) return void cb(Error(ERR_PATH_MUST_EXIST))
    const [, extType = 'j'] = extMatch
    const cwd = dirname(path)
    readPkgUp({ cwd }, (err, pkg) => {
      if (err) return void cb(err)
      const { type } = pkg.packageJson
      switch (type) {
        case undefined: {
          if (extType === 'j') return void cb(null, { esm: false, type, extType, path, pkgPath: pkg.path })
          if (extType === 'm') return void cb(null, { esm: true, type, extType, path, pkgPath: pkg.path })
          /* istanbul ignore else */
          if (extType === 'c') return void cb(null, { esm: false, type, extType, path, pkgPath: pkg.path })
          // unreachable
        }
        case 'commonjs': {
          if (extType === 'j') return void cb(null, { esm: false, type, extType, path, pkgPath: pkg.path })
          if (extType === 'm') return void cb(null, { esm: true, type, extType, path, pkgPath: pkg.path })
          /* istanbul ignore else */
          if (extType === 'c') return void cb(null, { esm: false, type, extType, path, pkgPath: pkg.path })
          // unreachable
        }
        case 'module': {
          if (extType === 'j') return void cb(null, { esm: true, type, extType, path, pkgPath: pkg.path })
          if (extType === 'm') return void cb(null, { esm: true, type, extType, path, pkgPath: pkg.path })
          /* istanbul ignore else */
          if (extType === 'c') return void cb(null, { esm: false, type, extType, path, pkgPath: pkg.path })
          // unreachable
        }
        default: return void cb(Object.assign(Error(`package.json type "${type}" not recognized`), { meta: { type, extType, path, pkgPath: pkg.path } }))
      }
    })
  })
}

isFileEsm.sync = function isFileEsmSync (path) {
  if (typeof path !== 'string') throw Error(ERR_PATH_MUST_BE_STRING)
  if (isAbsolute(path) === false) throw Error(ERR_PATH_MUST_BE_ABSOLUTE)
  const extMatch = /\.(c|m)?js/.exec(extname(path))
  if (extMatch === null) throw Error(ERR_PATH_MUST_HAVE_VALID_EXT)
  try {
    accessSync(path, F_OK)
  } catch (err) {
    throw Error(ERR_PATH_MUST_EXIST)
  }
  const [, extType = 'j'] = extMatch
  const cwd = dirname(path)
  const pkg = readPkgUp.sync({ cwd })
  const { type } = pkg.packageJson
  switch (type) {
    case undefined: {
      if (extType === 'j') return { esm: false, type, extType, path, pkgPath: pkg.path }
      if (extType === 'm') return { esm: true, type, extType, path, pkgPath: pkg.path }
      /* istanbul ignore else */
      if (extType === 'c') return { esm: false, type, extType, path, pkgPath: pkg.path }
      // unreachable
    }
    case 'commonjs': {
      if (extType === 'j') return { esm: false, type, extType, path, pkgPath: pkg.path }
      if (extType === 'm') return { esm: true, type, extType, path, pkgPath: pkg.path }
      /* istanbul ignore else */
      if (extType === 'c') return { esm: false, type, extType, path, pkgPath: pkg.path }
      // unreachable
    }
    case 'module': {
      if (extType === 'j') return { esm: true, type, extType, path, pkgPath: pkg.path }
      if (extType === 'm') return { esm: true, type, extType, path, pkgPath: pkg.path }
      /* istanbul ignore else */
      if (extType === 'c') return { esm: false, type, extType, path, pkgPath: pkg.path }
      // unreachable
    }
    default: throw Object.assign(Error(`package.json type "${type}" not recognized`), { meta: { type, extType, path, pkgPath: pkg.path } })
  }
}

isFileEsm.constants = {
  ERR_PATH_MUST_BE_STRING,
  ERR_PATH_MUST_BE_ABSOLUTE,
  ERR_PATH_MUST_EXIST,
  ERR_PATH_MUST_HAVE_VALID_EXT
}

module.exports = isFileEsm

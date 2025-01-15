'use strict';
var IS_PURE = require('../internals/is-pure');
var globalThis = require('../internals/global');
var defineGlobalProperty = require('../internals/define-global-property');

var SHARED = '__core-js_shared__';
var store = module.exports = globalThis[SHARED] || defineGlobalProperty(SHARED, {});

(store.versions || (store.versions = [])).push({
  version: '3.36.1',
  mode: IS_PURE ? 'pure' : 'global',
  copyright: '© 2014-2024 Denis Pushkarev (zloirock.ru)',
  license: 'https://github.com/zloirock/core-js/blob/v3.36.1/LICENSE',
  source: 'https://github.com/zloirock/core-js'
});

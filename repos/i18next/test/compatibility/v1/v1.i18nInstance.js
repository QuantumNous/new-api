import fs from 'node:fs';
import HttpApi from 'i18next-http-backend';
import Cache from 'i18next-localstorage-cache';
import sprintf from 'i18next-sprintf-postprocessor';
import LanguageDetector from 'i18next-browser-languagedetector';

import i18n from '../../../src/i18next.js';
import compatibilityLayer from '../v4/v4Compatibility';

import * as compat from './v1.js';

export function extend(obj, ...rest) {
  Array.prototype.forEach.call(Array.prototype.slice.call([obj, ...rest], 1), (source) => {
    if (source) {
      for (const prop in source) {
        obj[prop] = source[prop];
      }
    }
  });
  return compat.convertAPIOptions(obj);
  // return obj;
}

i18n.functions = {
  extend,
};

const httpApi = new HttpApi();

const cache = new Cache();
cache.debouncedStore = cache.store; // store without debounce

i18n
  .use({ type: 'formatter', init: () => {}, format: (v) => v })
  .use(compatibilityLayer)
  .use(httpApi)
  .use(cache)
  .use(new LanguageDetector())
  .use(sprintf);

compat.appendBackwardsAPI(i18n);

const originalT = i18n.t;
i18n.t = function t(key, opts, ...rest) {
  if (arguments.length > 2) return originalT.apply(i18n, [key, opts, ...rest]);
  if (typeof opts === 'object') opts = compat.convertTOptions(opts);
  return originalT.call(i18n, key, opts);
};

/**
 *
 * @param {string} language
 * @param {string} namespace
 * @param {import('i18next').ReadCallback} callback
 *
 * @returns {void}
 */
const httpApiReadMockImplementation = (language, namespace, callback) => {
  const namespacePath = `${__dirname}/locales/${language}/${namespace}.json`;

  // console.info('httpApiReadMockImplementation', namespacePath);

  if (fs.existsSync(namespacePath)) {
    const data = JSON.parse(fs.readFileSync(namespacePath, 'utf-8'));

    callback(null, data);
  } else {
    callback('File is not available in `locales` folder', null);
  }
};

/** using a function to have always a new object */
const getI18nCompatibilityV1InitOptions = () => ({
  compatibilityAPI: 'v1',
  compatibilityJSON: 'v1',
  lng: 'en-US',
  load: 'all',
  fallbackLng: 'dev',
  fallbackNS: [],
  fallbackOnNull: true,
  fallbackOnEmpty: false,
  preload: [],
  lowerCaseLng: false,
  ns: 'translation',
  fallbackToDefaultNS: false,
  resGetPath: 'http://localhost:9877/locales/__lng__/__ns__.json',
  dynamicLoad: false,
  useLocalStorage: false,
  sendMissing: false,
  resStore: false,
  getAsync: true,
  returnObjectTrees: false,
  debug: false,
  selectorAttr: 'data-i18n',
  postProcess: '',
  parseMissingKey: '',
  interpolationPrefix: '__',
  interpolationSuffix: '__',
  defaultVariables: false,
  shortcutFunction: 'sprintf',
  objectTreeKeyHandler: null,
  lngWhitelist: null,
  resources: null,
});

export {
  i18n as i18nCompatibilityV1,
  getI18nCompatibilityV1InitOptions,
  httpApi as httpApiCompatibilityV1,
  httpApiReadMockImplementation,
};

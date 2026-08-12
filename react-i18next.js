(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ReactI18next = {}, global.React));
})(this, (function (exports, React) { 'use strict';

  const isString$1 = obj => typeof obj === 'string';
  const defer = () => {
    let res;
    let rej;
    const promise = new Promise((resolve, reject) => {
      res = resolve;
      rej = reject;
    });
    promise.resolve = res;
    promise.reject = rej;
    return promise;
  };
  const makeString = object => {
    if (object == null) return '';
    return String(object);
  };
  const copy = (a, s, t) => {
    a.forEach(m => {
      if (s[m]) t[m] = s[m];
    });
  };
  const lastOfPathSeparatorRegExp = /###/g;
  const cleanKey = key => key && key.includes('###') ? key.replace(lastOfPathSeparatorRegExp, '.') : key;
  const canNotTraverseDeeper = object => !object || isString$1(object);
  const getLastOfPath = (object, path, Empty) => {
    const stack = !isString$1(path) ? path : path.split('.');
    let stackIndex = 0;
    while (stackIndex < stack.length - 1) {
      if (canNotTraverseDeeper(object)) return {};
      const key = cleanKey(stack[stackIndex]);
      if (!object[key] && Empty) object[key] = new Empty();
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        object = object[key];
      } else {
        object = {};
      }
      ++stackIndex;
    }
    if (canNotTraverseDeeper(object)) return {};
    return {
      obj: object,
      k: cleanKey(stack[stackIndex])
    };
  };
  const setPath = (object, path, newValue) => {
    const {
      obj,
      k
    } = getLastOfPath(object, path, Object);
    if (obj !== undefined || path.length === 1) {
      obj[k] = newValue;
      return;
    }
    let e = path[path.length - 1];
    let p = path.slice(0, path.length - 1);
    let last = getLastOfPath(object, p, Object);
    while (last.obj === undefined && p.length) {
      e = `${p[p.length - 1]}.${e}`;
      p = p.slice(0, p.length - 1);
      last = getLastOfPath(object, p, Object);
      if (last?.obj && typeof last.obj[`${last.k}.${e}`] !== 'undefined') {
        last.obj = undefined;
      }
    }
    last.obj[`${last.k}.${e}`] = newValue;
  };
  const pushPath = (object, path, newValue, concat) => {
    const {
      obj,
      k
    } = getLastOfPath(object, path, Object);
    obj[k] = obj[k] || [];
    obj[k].push(newValue);
  };
  const getPath = (object, path) => {
    const {
      obj,
      k
    } = getLastOfPath(object, path);
    if (!obj) return undefined;
    if (!Object.prototype.hasOwnProperty.call(obj, k)) return undefined;
    return obj[k];
  };
  const getPathWithDefaults = (data, defaultData, key) => {
    const value = getPath(data, key);
    if (value !== undefined) {
      return value;
    }
    return getPath(defaultData, key);
  };
  const deepExtend = (target, source, overwrite) => {
    for (const prop in source) {
      if (prop !== '__proto__' && prop !== 'constructor') {
        if (prop in target) {
          if (isString$1(target[prop]) || target[prop] instanceof String || isString$1(source[prop]) || source[prop] instanceof String) {
            if (overwrite) target[prop] = source[prop];
          } else {
            deepExtend(target[prop], source[prop], overwrite);
          }
        } else {
          target[prop] = source[prop];
        }
      }
    }
    return target;
  };
  const regexEscape = str => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
  const _entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  const escape = data => {
    if (isString$1(data)) {
      return data.replace(/[&<>"'\/]/g, s => _entityMap[s]);
    }
    return data;
  };
  class RegExpCache {
    constructor(capacity) {
      this.capacity = capacity;
      this.regExpMap = new Map();
      this.regExpQueue = [];
    }
    getRegExp(pattern) {
      const regExpFromCache = this.regExpMap.get(pattern);
      if (regExpFromCache !== undefined) {
        return regExpFromCache;
      }
      const regExpNew = new RegExp(pattern);
      if (this.regExpQueue.length === this.capacity) {
        this.regExpMap.delete(this.regExpQueue.shift());
      }
      this.regExpMap.set(pattern, regExpNew);
      this.regExpQueue.push(pattern);
      return regExpNew;
    }
  }
  const chars = [' ', ',', '?', '!', ';'];
  const looksLikeObjectPathRegExpCache = new RegExpCache(20);
  const looksLikeObjectPath = (key, nsSeparator, keySeparator) => {
    nsSeparator = nsSeparator || '';
    keySeparator = keySeparator || '';
    const possibleChars = chars.filter(c => !nsSeparator.includes(c) && !keySeparator.includes(c));
    if (possibleChars.length === 0) return true;
    const r = looksLikeObjectPathRegExpCache.getRegExp(`(${possibleChars.map(c => c === '?' ? '\\?' : c).join('|')})`);
    let matched = !r.test(key);
    if (!matched) {
      const ki = key.indexOf(keySeparator);
      if (ki > 0 && !r.test(key.substring(0, ki))) {
        matched = true;
      }
    }
    return matched;
  };
  const deepFind = (obj, path, keySeparator = '.') => {
    if (!obj) return undefined;
    if (obj[path]) {
      if (!Object.prototype.hasOwnProperty.call(obj, path)) return undefined;
      return obj[path];
    }
    const tokens = path.split(keySeparator);
    let current = obj;
    for (let i = 0; i < tokens.length;) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      let next;
      let nextPath = '';
      for (let j = i; j < tokens.length; ++j) {
        if (j !== i) {
          nextPath += keySeparator;
        }
        nextPath += tokens[j];
        next = current[nextPath];
        if (next !== undefined) {
          if (['string', 'number', 'boolean'].includes(typeof next) && j < tokens.length - 1) {
            continue;
          }
          i += j - i + 1;
          break;
        }
      }
      current = next;
    }
    return current;
  };
  const getCleanedCode = code => code?.replace(/_/g, '-');
  const consoleLogger = {
    type: 'logger',
    log(args) {
      this.output('log', args);
    },
    warn(args) {
      this.output('warn', args);
    },
    error(args) {
      this.output('error', args);
    },
    output(type, args) {
      console?.[type]?.apply?.(console, args);
    }
  };
  class Logger {
    constructor(concreteLogger, options = {}) {
      this.init(concreteLogger, options);
    }
    init(concreteLogger, options = {}) {
      this.prefix = options.prefix || 'i18next:';
      this.logger = concreteLogger || consoleLogger;
      this.options = options;
      this.debug = options.debug;
    }
    log(...args) {
      return this.forward(args, 'log', '', true);
    }
    warn(...args) {
      return this.forward(args, 'warn', '', true);
    }
    error(...args) {
      return this.forward(args, 'error', '');
    }
    deprecate(...args) {
      return this.forward(args, 'warn', 'WARNING DEPRECATED: ', true);
    }
    forward(args, lvl, prefix, debugOnly) {
      if (debugOnly && !this.debug) return null;
      args = args.map(a => isString$1(a) ? a.replace(/[\r\n\x00-\x1F\x7F]/g, ' ') : a);
      if (isString$1(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
      return this.logger[lvl](args);
    }
    create(moduleName) {
      return new Logger(this.logger, {
        ...{
          prefix: `${this.prefix}:${moduleName}:`
        },
        ...this.options
      });
    }
    clone(options) {
      options = options || this.options;
      options.prefix = options.prefix || this.prefix;
      return new Logger(this.logger, options);
    }
  }
  var baseLogger = new Logger();
  class EventEmitter {
    constructor() {
      this.observers = {};
    }
    on(events, listener) {
      events.split(' ').forEach(event => {
        if (!this.observers[event]) this.observers[event] = new Map();
        const numListeners = this.observers[event].get(listener) || 0;
        this.observers[event].set(listener, numListeners + 1);
      });
      return this;
    }
    off(event, listener) {
      if (!this.observers[event]) return;
      if (!listener) {
        delete this.observers[event];
        return;
      }
      this.observers[event].delete(listener);
    }
    once(event, listener) {
      const wrapper = (...args) => {
        listener(...args);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
      return this;
    }
    emit(event, ...args) {
      if (this.observers[event]) {
        const cloned = Array.from(this.observers[event].entries());
        cloned.forEach(([observer, numTimesAdded]) => {
          for (let i = 0; i < numTimesAdded; i++) {
            observer(...args);
          }
        });
      }
      if (this.observers['*']) {
        const cloned = Array.from(this.observers['*'].entries());
        cloned.forEach(([observer, numTimesAdded]) => {
          for (let i = 0; i < numTimesAdded; i++) {
            observer(event, ...args);
          }
        });
      }
    }
  }
  class ResourceStore extends EventEmitter {
    constructor(data, options = {
      ns: ['translation'],
      defaultNS: 'translation'
    }) {
      super();
      this.data = data || {};
      this.options = options;
      if (this.options.keySeparator === undefined) {
        this.options.keySeparator = '.';
      }
      if (this.options.ignoreJSONStructure === undefined) {
        this.options.ignoreJSONStructure = true;
      }
    }
    addNamespaces(ns) {
      if (!this.options.ns.includes(ns)) {
        this.options.ns.push(ns);
      }
    }
    removeNamespaces(ns) {
      const index = this.options.ns.indexOf(ns);
      if (index > -1) {
        this.options.ns.splice(index, 1);
      }
    }
    getResource(lng, ns, key, options = {}) {
      const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
      const ignoreJSONStructure = options.ignoreJSONStructure !== undefined ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
      let path;
      if (lng.includes('.')) {
        path = lng.split('.');
      } else {
        path = [lng, ns];
        if (key) {
          if (Array.isArray(key)) {
            path.push(...key);
          } else if (isString$1(key) && keySeparator) {
            path.push(...key.split(keySeparator));
          } else {
            path.push(key);
          }
        }
      }
      const result = getPath(this.data, path);
      if (!result && !ns && !key && lng.includes('.')) {
        lng = path[0];
        ns = path[1];
        key = path.slice(2).join('.');
      }
      if (result || !ignoreJSONStructure || !isString$1(key)) return result;
      return deepFind(this.data?.[lng]?.[ns], key, keySeparator);
    }
    addResource(lng, ns, key, value, options = {
      silent: false
    }) {
      const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
      let path = [lng, ns];
      if (key) path = path.concat(keySeparator ? key.split(keySeparator) : key);
      if (lng.includes('.')) {
        path = lng.split('.');
        value = ns;
        ns = path[1];
      }
      this.addNamespaces(ns);
      setPath(this.data, path, value);
      if (!options.silent) this.emit('added', lng, ns, key, value);
    }
    addResources(lng, ns, resources, options = {
      silent: false
    }) {
      for (const m in resources) {
        if (isString$1(resources[m]) || Array.isArray(resources[m])) this.addResource(lng, ns, m, resources[m], {
          silent: true
        });
      }
      if (!options.silent) this.emit('added', lng, ns, resources);
    }
    addResourceBundle(lng, ns, resources, deep, overwrite, options = {
      silent: false,
      skipCopy: false
    }) {
      let path = [lng, ns];
      if (lng.includes('.')) {
        path = lng.split('.');
        deep = resources;
        resources = ns;
        ns = path[1];
      }
      this.addNamespaces(ns);
      let pack = getPath(this.data, path) || {};
      if (!options.skipCopy) resources = JSON.parse(JSON.stringify(resources));
      if (deep) {
        deepExtend(pack, resources, overwrite);
      } else {
        pack = {
          ...pack,
          ...resources
        };
      }
      setPath(this.data, path, pack);
      if (!options.silent) this.emit('added', lng, ns, resources);
    }
    removeResourceBundle(lng, ns) {
      if (this.hasResourceBundle(lng, ns)) {
        delete this.data[lng][ns];
      }
      this.removeNamespaces(ns);
      this.emit('removed', lng, ns);
    }
    hasResourceBundle(lng, ns) {
      return this.getResource(lng, ns) !== undefined;
    }
    getResourceBundle(lng, ns) {
      if (!ns) ns = this.options.defaultNS;
      return this.getResource(lng, ns);
    }
    getDataByLanguage(lng) {
      return this.data[lng];
    }
    hasLanguageSomeTranslations(lng) {
      const data = this.getDataByLanguage(lng);
      const n = data && Object.keys(data) || [];
      return !!n.find(v => data[v] && Object.keys(data[v]).length > 0);
    }
    toJSON() {
      return this.data;
    }
  }
  var postProcessor = {
    processors: {},
    addPostProcessor(module) {
      this.processors[module.name] = module;
    },
    handle(processors, value, key, options, translator) {
      processors.forEach(processor => {
        value = this.processors[processor]?.process(value, key, options, translator) ?? value;
      });
      return value;
    }
  };
  const PATH_KEY = Symbol('i18next/PATH_KEY');
  function createProxy() {
    const state = [];
    const handler = Object.create(null);
    let proxy;
    handler.get = (target, key) => {
      proxy?.revoke?.();
      if (key === PATH_KEY) return state;
      state.push(key);
      proxy = Proxy.revocable(target, handler);
      return proxy.proxy;
    };
    return Proxy.revocable(Object.create(null), handler).proxy;
  }
  function keysFromSelector(selector, opts) {
    const {
      [PATH_KEY]: path
    } = selector(createProxy());
    const keySeparator = opts?.keySeparator ?? '.';
    const nsSeparator = opts?.nsSeparator ?? ':';
    if (path.length > 1 && nsSeparator) {
      const ns = opts?.ns;
      const nsArray = Array.isArray(ns) ? ns : null;
      if (nsArray && nsArray.length > 1 && nsArray.slice(1).includes(path[0])) {
        return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
      }
    }
    return path.join(keySeparator);
  }
  const shouldHandleAsObject = res => !isString$1(res) && typeof res !== 'boolean' && typeof res !== 'number';
  class Translator extends EventEmitter {
    constructor(services, options = {}) {
      super();
      copy(['resourceStore', 'languageUtils', 'pluralResolver', 'interpolator', 'backendConnector', 'i18nFormat', 'utils'], services, this);
      this.options = options;
      if (this.options.keySeparator === undefined) {
        this.options.keySeparator = '.';
      }
      this.logger = baseLogger.create('translator');
      this.checkedLoadedFor = {};
    }
    changeLanguage(lng) {
      if (lng) this.language = lng;
    }
    exists(key, o = {
      interpolation: {}
    }) {
      const opt = {
        ...o
      };
      if (key == null) return false;
      const resolved = this.resolve(key, opt);
      if (resolved?.res === undefined) return false;
      const isObject = shouldHandleAsObject(resolved.res);
      if (opt.returnObjects === false && isObject) {
        return false;
      }
      return true;
    }
    extractFromKey(key, opt) {
      let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
      if (nsSeparator === undefined) nsSeparator = ':';
      const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
      let namespaces = opt.ns || this.options.defaultNS || [];
      const wouldCheckForNsInKey = nsSeparator && key.includes(nsSeparator);
      const seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !opt.keySeparator && !this.options.userDefinedNsSeparator && !opt.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
      if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
        const m = key.match(this.interpolator.nestingRegexp);
        if (m && m.length > 0) {
          return {
            key,
            namespaces: isString$1(namespaces) ? [namespaces] : namespaces
          };
        }
        const parts = key.split(nsSeparator);
        if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.includes(parts[0])) namespaces = parts.shift();
        key = parts.join(keySeparator);
      }
      return {
        key,
        namespaces: isString$1(namespaces) ? [namespaces] : namespaces
      };
    }
    translate(keys, o, lastKey) {
      let opt = typeof o === 'object' ? {
        ...o
      } : o;
      if (typeof opt !== 'object' && this.options.overloadTranslationOptionHandler) {
        opt = this.options.overloadTranslationOptionHandler(arguments);
      }
      if (typeof opt === 'object') opt = {
        ...opt
      };
      if (!opt) opt = {};
      if (keys == null) return '';
      if (typeof keys === 'function') keys = keysFromSelector(keys, {
        ...this.options,
        ...opt
      });
      if (!Array.isArray(keys)) keys = [String(keys)];
      keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
        ...this.options,
        ...opt
      }) : String(k));
      const returnDetails = opt.returnDetails !== undefined ? opt.returnDetails : this.options.returnDetails;
      const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
      const {
        key,
        namespaces
      } = this.extractFromKey(keys[keys.length - 1], opt);
      const namespace = namespaces[namespaces.length - 1];
      let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
      if (nsSeparator === undefined) nsSeparator = ':';
      const lng = opt.lng || this.language;
      const appendNamespaceToCIMode = opt.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
      if (lng?.toLowerCase() === 'cimode') {
        if (appendNamespaceToCIMode) {
          if (returnDetails) {
            return {
              res: `${namespace}${nsSeparator}${key}`,
              usedKey: key,
              exactUsedKey: key,
              usedLng: lng,
              usedNS: namespace,
              usedParams: this.getUsedParamsDetails(opt)
            };
          }
          return `${namespace}${nsSeparator}${key}`;
        }
        if (returnDetails) {
          return {
            res: key,
            usedKey: key,
            exactUsedKey: key,
            usedLng: lng,
            usedNS: namespace,
            usedParams: this.getUsedParamsDetails(opt)
          };
        }
        return key;
      }
      const resolved = this.resolve(keys, opt);
      let res = resolved?.res;
      const resUsedKey = resolved?.usedKey || key;
      const resExactUsedKey = resolved?.exactUsedKey || key;
      const noObject = ['[object Number]', '[object Function]', '[object RegExp]'];
      const joinArrays = opt.joinArrays !== undefined ? opt.joinArrays : this.options.joinArrays;
      const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
      const needsPluralHandling = opt.count !== undefined && !isString$1(opt.count);
      const hasDefaultValue = Translator.hasDefaultValue(opt);
      const defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, opt) : '';
      const defaultValueSuffixOrdinalFallback = opt.ordinal && needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, {
        ordinal: false
      }) : '';
      const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
      const defaultValue = needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] || opt[`defaultValue${defaultValueSuffix}`] || opt[`defaultValue${defaultValueSuffixOrdinalFallback}`] || opt.defaultValue;
      let resForObjHndl = res;
      if (handleAsObjectInI18nFormat && !res && hasDefaultValue) {
        resForObjHndl = defaultValue;
      }
      const handleAsObject = shouldHandleAsObject(resForObjHndl);
      const resType = Object.prototype.toString.apply(resForObjHndl);
      if (handleAsObjectInI18nFormat && resForObjHndl && handleAsObject && !noObject.includes(resType) && !(isString$1(joinArrays) && Array.isArray(resForObjHndl))) {
        if (!opt.returnObjects && !this.options.returnObjects) {
          if (!this.options.returnedObjectHandler) {
            this.logger.warn('accessing an object - but returnObjects options is not enabled!');
          }
          const r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, resForObjHndl, {
            ...opt,
            ns: namespaces
          }) : `key '${key} (${this.language})' returned an object instead of string.`;
          if (returnDetails) {
            resolved.res = r;
            resolved.usedParams = this.getUsedParamsDetails(opt);
            return resolved;
          }
          return r;
        }
        if (keySeparator) {
          const resTypeIsArray = Array.isArray(resForObjHndl);
          const copy = resTypeIsArray ? [] : {};
          const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
          for (const m in resForObjHndl) {
            if (Object.prototype.hasOwnProperty.call(resForObjHndl, m)) {
              const deepKey = `${newKeyToUse}${keySeparator}${m}`;
              if (hasDefaultValue && !res) {
                copy[m] = this.translate(deepKey, {
                  ...opt,
                  defaultValue: shouldHandleAsObject(defaultValue) ? defaultValue[m] : undefined,
                  ...{
                    joinArrays: false,
                    ns: namespaces
                  }
                });
              } else {
                copy[m] = this.translate(deepKey, {
                  ...opt,
                  ...{
                    joinArrays: false,
                    ns: namespaces
                  }
                });
              }
              if (copy[m] === deepKey) copy[m] = resForObjHndl[m];
            }
          }
          res = copy;
        }
      } else if (handleAsObjectInI18nFormat && isString$1(joinArrays) && Array.isArray(res)) {
        res = res.join(joinArrays);
        if (res) res = this.extendTranslation(res, keys, opt, lastKey);
      } else {
        let usedDefault = false;
        let usedKey = false;
        if (!this.isValidLookup(res) && hasDefaultValue) {
          usedDefault = true;
          res = defaultValue;
        }
        if (!this.isValidLookup(res)) {
          usedKey = true;
          res = key;
        }
        const missingKeyNoValueFallbackToKey = opt.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
        const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
        const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
        if (usedKey || usedDefault || updateMissing) {
          this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, needsPluralHandling && !updateMissing ? `${key}${this.pluralResolver.getSuffix(lng, opt.count, opt)}` : key, updateMissing ? defaultValue : res);
          if (keySeparator) {
            const fk = this.resolve(key, {
              ...opt,
              keySeparator: false
            });
            if (fk && fk.res) this.logger.warn('Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.');
          }
          let lngs = [];
          const fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, opt.lng || this.language);
          if (this.options.saveMissingTo === 'fallback' && fallbackLngs && fallbackLngs[0]) {
            for (let i = 0; i < fallbackLngs.length; i++) {
              lngs.push(fallbackLngs[i]);
            }
          } else if (this.options.saveMissingTo === 'all') {
            lngs = this.languageUtils.toResolveHierarchy(opt.lng || this.language);
          } else {
            lngs.push(opt.lng || this.language);
          }
          const send = (l, k, specificDefaultValue) => {
            const defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
            if (this.options.missingKeyHandler) {
              this.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, opt);
            } else if (this.backendConnector?.saveMissing) {
              this.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, opt);
            }
            this.emit('missingKey', l, namespace, k, res);
          };
          if (this.options.saveMissing) {
            if (this.options.saveMissingPlurals && needsPluralHandling) {
              lngs.forEach(language => {
                const suffixes = this.pluralResolver.getSuffixes(language, opt);
                if (needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] && !suffixes.includes(`${this.options.pluralSeparator}zero`)) {
                  suffixes.push(`${this.options.pluralSeparator}zero`);
                }
                suffixes.forEach(suffix => {
                  send([language], key + suffix, opt[`defaultValue${suffix}`] || defaultValue);
                });
              });
            } else {
              send(lngs, key, defaultValue);
            }
          }
        }
        res = this.extendTranslation(res, keys, opt, resolved, lastKey);
        if (usedKey && res === key && this.options.appendNamespaceToMissingKey) {
          res = `${namespace}${nsSeparator}${key}`;
        }
        if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
          res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${namespace}${nsSeparator}${key}` : key, usedDefault ? res : undefined, opt);
        }
      }
      if (returnDetails) {
        resolved.res = res;
        resolved.usedParams = this.getUsedParamsDetails(opt);
        return resolved;
      }
      return res;
    }
    extendTranslation(res, key, opt, resolved, lastKey) {
      if (this.i18nFormat?.parse) {
        res = this.i18nFormat.parse(res, {
          ...this.options.interpolation.defaultVariables,
          ...opt
        }, opt.lng || this.language || resolved.usedLng, resolved.usedNS, resolved.usedKey, {
          resolved
        });
      } else if (!opt.skipInterpolation) {
        if (opt.interpolation) this.interpolator.init({
          ...opt,
          ...{
            interpolation: {
              ...this.options.interpolation,
              ...opt.interpolation
            }
          }
        });
        const skipOnVariables = isString$1(res) && (opt?.interpolation?.skipOnVariables !== undefined ? opt.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
        let nestBef;
        if (skipOnVariables) {
          const nb = res.match(this.interpolator.nestingRegexp);
          nestBef = nb && nb.length;
        }
        let data = opt.replace && !isString$1(opt.replace) ? opt.replace : opt;
        if (this.options.interpolation.defaultVariables) data = {
          ...this.options.interpolation.defaultVariables,
          ...data
        };
        res = this.interpolator.interpolate(res, data, opt.lng || this.language || resolved.usedLng, opt);
        if (skipOnVariables) {
          const na = res.match(this.interpolator.nestingRegexp);
          const nestAft = na && na.length;
          if (nestBef < nestAft) opt.nest = false;
        }
        if (!opt.lng && resolved && resolved.res) opt.lng = this.language || resolved.usedLng;
        if (opt.nest !== false) res = this.interpolator.nest(res, (...args) => {
          if (lastKey?.[0] === args[0] && !opt.context) {
            this.logger.warn(`It seems you are nesting recursively key: ${args[0]} in key: ${key[0]}`);
            return null;
          }
          return this.translate(...args, key);
        }, opt);
        if (opt.interpolation) this.interpolator.reset();
      }
      const postProcess = opt.postProcess || this.options.postProcess;
      const postProcessorNames = isString$1(postProcess) ? [postProcess] : postProcess;
      if (res != null && postProcessorNames?.length && opt.applyPostProcessor !== false) {
        res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? {
          i18nResolved: {
            ...resolved,
            usedParams: this.getUsedParamsDetails(opt)
          },
          ...opt
        } : opt, this);
      }
      return res;
    }
    resolve(keys, opt = {}) {
      let found;
      let usedKey;
      let exactUsedKey;
      let usedLng;
      let usedNS;
      if (isString$1(keys)) keys = [keys];
      if (Array.isArray(keys)) keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
        ...this.options,
        ...opt
      }) : k);
      keys.forEach(k => {
        if (this.isValidLookup(found)) return;
        const extracted = this.extractFromKey(k, opt);
        const key = extracted.key;
        usedKey = key;
        let namespaces = extracted.namespaces;
        if (this.options.fallbackNS) namespaces = namespaces.concat(this.options.fallbackNS);
        const needsPluralHandling = opt.count !== undefined && !isString$1(opt.count);
        const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
        const needsContextHandling = opt.context !== undefined && (isString$1(opt.context) || typeof opt.context === 'number') && opt.context !== '';
        const codes = opt.lngs ? opt.lngs : this.languageUtils.toResolveHierarchy(opt.lng || this.language, opt.fallbackLng);
        namespaces.forEach(ns => {
          if (this.isValidLookup(found)) return;
          usedNS = ns;
          if (!this.checkedLoadedFor[`${codes[0]}-${ns}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(usedNS)) {
            this.checkedLoadedFor[`${codes[0]}-${ns}`] = true;
            this.logger.warn(`key "${usedKey}" for languages "${codes.join(', ')}" won't get resolved as namespace "${usedNS}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
          }
          codes.forEach(code => {
            if (this.isValidLookup(found)) return;
            usedLng = code;
            const finalKeys = [key];
            if (this.i18nFormat?.addLookupKeys) {
              this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, opt);
            } else {
              let pluralSuffix;
              if (needsPluralHandling) pluralSuffix = this.pluralResolver.getSuffix(code, opt.count, opt);
              const zeroSuffix = `${this.options.pluralSeparator}zero`;
              const ordinalPrefix = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
              if (needsPluralHandling) {
                if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                  finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                }
                finalKeys.push(key + pluralSuffix);
                if (needsZeroSuffixLookup) {
                  finalKeys.push(key + zeroSuffix);
                }
              }
              if (needsContextHandling) {
                const contextKey = `${key}${this.options.contextSeparator || '_'}${opt.context}`;
                finalKeys.push(contextKey);
                if (needsPluralHandling) {
                  if (opt.ordinal && pluralSuffix.startsWith(ordinalPrefix)) {
                    finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                  }
                  finalKeys.push(contextKey + pluralSuffix);
                  if (needsZeroSuffixLookup) {
                    finalKeys.push(contextKey + zeroSuffix);
                  }
                }
              }
            }
            let possibleKey;
            while (possibleKey = finalKeys.pop()) {
              if (!this.isValidLookup(found)) {
                exactUsedKey = possibleKey;
                found = this.getResource(code, ns, possibleKey, opt);
              }
            }
          });
        });
      });
      return {
        res: found,
        usedKey,
        exactUsedKey,
        usedLng,
        usedNS
      };
    }
    isValidLookup(res) {
      return res !== undefined && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === '');
    }
    getResource(code, ns, key, options = {}) {
      if (this.i18nFormat?.getResource) return this.i18nFormat.getResource(code, ns, key, options);
      return this.resourceStore.getResource(code, ns, key, options);
    }
    getUsedParamsDetails(options = {}) {
      const optionsKeys = ['defaultValue', 'ordinal', 'context', 'replace', 'lng', 'lngs', 'fallbackLng', 'ns', 'keySeparator', 'nsSeparator', 'returnObjects', 'returnDetails', 'joinArrays', 'postProcess', 'interpolation'];
      const useOptionsReplaceForData = options.replace && !isString$1(options.replace);
      let data = useOptionsReplaceForData ? options.replace : options;
      if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
        data.count = options.count;
      }
      if (this.options.interpolation.defaultVariables) {
        data = {
          ...this.options.interpolation.defaultVariables,
          ...data
        };
      }
      if (!useOptionsReplaceForData) {
        data = {
          ...data
        };
        for (const key of optionsKeys) {
          delete data[key];
        }
      }
      return data;
    }
    static hasDefaultValue(options) {
      const prefix = 'defaultValue';
      for (const option in options) {
        if (Object.prototype.hasOwnProperty.call(options, option) && option.startsWith(prefix) && undefined !== options[option]) {
          return true;
        }
      }
      return false;
    }
  }
  class LanguageUtil {
    constructor(options) {
      this.options = options;
      this.supportedLngs = this.options.supportedLngs || false;
      this.logger = baseLogger.create('languageUtils');
    }
    getScriptPartFromCode(code) {
      code = getCleanedCode(code);
      if (!code || !code.includes('-')) return null;
      const p = code.split('-');
      if (p.length === 2) return null;
      p.pop();
      if (p[p.length - 1].toLowerCase() === 'x') return null;
      return this.formatLanguageCode(p.join('-'));
    }
    getLanguagePartFromCode(code) {
      code = getCleanedCode(code);
      if (!code || !code.includes('-')) return code;
      const p = code.split('-');
      return this.formatLanguageCode(p[0]);
    }
    formatLanguageCode(code) {
      if (isString$1(code) && code.includes('-')) {
        let formattedCode;
        try {
          formattedCode = Intl.getCanonicalLocales(code)[0];
        } catch (e) {}
        if (formattedCode && this.options.lowerCaseLng) {
          formattedCode = formattedCode.toLowerCase();
        }
        if (formattedCode) return formattedCode;
        if (this.options.lowerCaseLng) {
          return code.toLowerCase();
        }
        return code;
      }
      return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
    }
    isSupportedCode(code) {
      if (this.options.load === 'languageOnly' || this.options.nonExplicitSupportedLngs) {
        code = this.getLanguagePartFromCode(code);
      }
      return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.includes(code);
    }
    getBestMatchFromCodes(codes) {
      if (!codes) return null;
      let found;
      codes.forEach(code => {
        if (found) return;
        const cleanedLng = this.formatLanguageCode(code);
        if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) found = cleanedLng;
      });
      if (!found && this.options.supportedLngs) {
        codes.forEach(code => {
          if (found) return;
          const lngScOnly = this.getScriptPartFromCode(code);
          if (this.isSupportedCode(lngScOnly)) return found = lngScOnly;
          const lngOnly = this.getLanguagePartFromCode(code);
          if (this.isSupportedCode(lngOnly)) return found = lngOnly;
          found = this.options.supportedLngs.find(supportedLng => {
            if (supportedLng === lngOnly) return true;
            if (!supportedLng.includes('-') && !lngOnly.includes('-')) return false;
            if (supportedLng.includes('-') && !lngOnly.includes('-') && supportedLng.slice(0, supportedLng.indexOf('-')) === lngOnly) return true;
            if (supportedLng.startsWith(lngOnly) && lngOnly.length > 1) return true;
            return false;
          });
        });
      }
      if (!found) found = this.getFallbackCodes(this.options.fallbackLng)[0];
      return found;
    }
    getFallbackCodes(fallbacks, code) {
      if (!fallbacks) return [];
      if (typeof fallbacks === 'function') fallbacks = fallbacks(code);
      if (isString$1(fallbacks)) fallbacks = [fallbacks];
      if (Array.isArray(fallbacks)) return fallbacks;
      if (!code) return fallbacks.default || [];
      let found = fallbacks[code];
      if (!found) found = fallbacks[this.getScriptPartFromCode(code)];
      if (!found) found = fallbacks[this.formatLanguageCode(code)];
      if (!found) found = fallbacks[this.getLanguagePartFromCode(code)];
      if (!found) found = fallbacks.default;
      return found || [];
    }
    toResolveHierarchy(code, fallbackCode) {
      const fallbackCodes = this.getFallbackCodes((fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [], code);
      const codes = [];
      const addCode = c => {
        if (!c) return;
        if (this.isSupportedCode(c)) {
          codes.push(c);
        } else {
          this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
        }
      };
      if (isString$1(code) && (code.includes('-') || code.includes('_'))) {
        if (this.options.load !== 'languageOnly') addCode(this.formatLanguageCode(code));
        if (this.options.load !== 'languageOnly' && this.options.load !== 'currentOnly') addCode(this.getScriptPartFromCode(code));
        if (this.options.load !== 'currentOnly') addCode(this.getLanguagePartFromCode(code));
      } else if (isString$1(code)) {
        addCode(this.formatLanguageCode(code));
      }
      fallbackCodes.forEach(fc => {
        if (!codes.includes(fc)) addCode(this.formatLanguageCode(fc));
      });
      return codes;
    }
  }
  const suffixesOrder = {
    zero: 0,
    one: 1,
    two: 2,
    few: 3,
    many: 4,
    other: 5
  };
  const dummyRule = {
    select: count => count === 1 ? 'one' : 'other',
    resolvedOptions: () => ({
      pluralCategories: ['one', 'other']
    })
  };
  class PluralResolver {
    constructor(languageUtils, options = {}) {
      this.languageUtils = languageUtils;
      this.options = options;
      this.logger = baseLogger.create('pluralResolver');
      this.pluralRulesCache = {};
    }
    clearCache() {
      this.pluralRulesCache = {};
    }
    getRule(code, options = {}) {
      const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
      const type = options.ordinal ? 'ordinal' : 'cardinal';
      const cacheKey = JSON.stringify({
        cleanedCode,
        type
      });
      if (cacheKey in this.pluralRulesCache) {
        return this.pluralRulesCache[cacheKey];
      }
      let rule;
      try {
        rule = new Intl.PluralRules(cleanedCode, {
          type
        });
      } catch (err) {
        if (typeof Intl === 'undefined') {
          this.logger.error('No Intl support, please use an Intl polyfill!');
          return dummyRule;
        }
        if (!code.match(/-|_/)) return dummyRule;
        const lngPart = this.languageUtils.getLanguagePartFromCode(code);
        rule = this.getRule(lngPart, options);
      }
      this.pluralRulesCache[cacheKey] = rule;
      return rule;
    }
    needsPlural(code, options = {}) {
      let rule = this.getRule(code, options);
      if (!rule) rule = this.getRule('dev', options);
      return rule?.resolvedOptions().pluralCategories.length > 1;
    }
    getPluralFormsOfKey(code, key, options = {}) {
      return this.getSuffixes(code, options).map(suffix => `${key}${suffix}`);
    }
    getSuffixes(code, options = {}) {
      let rule = this.getRule(code, options);
      if (!rule) rule = this.getRule('dev', options);
      if (!rule) return [];
      return rule.resolvedOptions().pluralCategories.sort((pluralCategory1, pluralCategory2) => suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2]).map(pluralCategory => `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${pluralCategory}`);
    }
    getSuffix(code, count, options = {}) {
      const rule = this.getRule(code, options);
      if (rule) {
        return `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${rule.select(count)}`;
      }
      this.logger.warn(`no plural rule found for: ${code}`);
      return this.getSuffix('dev', count, options);
    }
  }
  const deepFindWithDefaults = (data, defaultData, key, keySeparator = '.', ignoreJSONStructure = true) => {
    let path = getPathWithDefaults(data, defaultData, key);
    if (!path && ignoreJSONStructure && isString$1(key)) {
      path = deepFind(data, key, keySeparator);
      if (path === undefined) path = deepFind(defaultData, key, keySeparator);
    }
    return path;
  };
  const regexSafe = val => val.replace(/\$/g, '$$$$');
  class Interpolator {
    constructor(options = {}) {
      this.logger = baseLogger.create('interpolator');
      this.options = options;
      this.format = options?.interpolation?.format || (value => value);
      this.init(options);
    }
    init(options = {}) {
      if (!options.interpolation) options.interpolation = {
        escapeValue: true
      };
      const {
        escape: escape$1,
        escapeValue,
        useRawValueToEscape,
        prefix,
        prefixEscaped,
        suffix,
        suffixEscaped,
        formatSeparator,
        unescapeSuffix,
        unescapePrefix,
        nestingPrefix,
        nestingPrefixEscaped,
        nestingSuffix,
        nestingSuffixEscaped,
        nestingOptionsSeparator,
        maxReplaces,
        alwaysFormat
      } = options.interpolation;
      this.escape = escape$1 !== undefined ? escape$1 : escape;
      this.escapeValue = escapeValue !== undefined ? escapeValue : true;
      this.useRawValueToEscape = useRawValueToEscape !== undefined ? useRawValueToEscape : false;
      this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
      this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';
      this.formatSeparator = formatSeparator || ',';
      this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix ? regexEscape(unescapePrefix) : '-';
      this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix ? regexEscape(unescapeSuffix) : '';
      this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape('$t(');
      this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(')');
      this.nestingOptionsSeparator = nestingOptionsSeparator || ',';
      this.maxReplaces = maxReplaces || 1000;
      this.alwaysFormat = alwaysFormat !== undefined ? alwaysFormat : false;
      this.resetRegExp();
    }
    reset() {
      if (this.options) this.init(this.options);
    }
    resetRegExp() {
      const getOrResetRegExp = (existingRegExp, pattern) => {
        if (existingRegExp?.source === pattern) {
          existingRegExp.lastIndex = 0;
          return existingRegExp;
        }
        return new RegExp(pattern, 'g');
      };
      this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
      this.regexpUnescape = getOrResetRegExp(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`);
      this.nestingRegexp = getOrResetRegExp(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']+|"[^"]*"|'[^']*'|\\((?:[^()]|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
    }
    interpolate(str, data, lng, options) {
      let match;
      let value;
      let replaces;
      const defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
      const handleFormat = key => {
        if (!key.includes(this.formatSeparator)) {
          const path = deepFindWithDefaults(data, defaultData, key, this.options.keySeparator, this.options.ignoreJSONStructure);
          return this.alwaysFormat ? this.format(path, undefined, lng, {
            ...options,
            ...data,
            interpolationkey: key
          }) : path;
        }
        const p = key.split(this.formatSeparator);
        const k = p.shift().trim();
        const f = p.join(this.formatSeparator).trim();
        return this.format(deepFindWithDefaults(data, defaultData, k, this.options.keySeparator, this.options.ignoreJSONStructure), f, lng, {
          ...options,
          ...data,
          interpolationkey: k
        });
      };
      this.resetRegExp();
      if (!this.escapeValue && typeof str === 'string' && /\$t\([^)]*\{[^}]*\{\{/.test(str)) {
        this.logger.warn('nesting options string contains interpolated variables with escapeValue: false — ' + 'if any of those values are attacker-controlled they can inject additional ' + 'nesting options (e.g. redirect lng/ns). Sanitise untrusted input before passing ' + 'it to t(), or keep escapeValue: true.');
      }
      const missingInterpolationHandler = options?.missingInterpolationHandler || this.options.missingInterpolationHandler;
      const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
      const todos = [{
        regex: this.regexpUnescape,
        safeValue: val => regexSafe(val)
      }, {
        regex: this.regexp,
        safeValue: val => this.escapeValue ? regexSafe(this.escape(val)) : regexSafe(val)
      }];
      todos.forEach(todo => {
        replaces = 0;
        while (match = todo.regex.exec(str)) {
          const matchedVar = match[1].trim();
          value = handleFormat(matchedVar);
          if (value === undefined) {
            if (typeof missingInterpolationHandler === 'function') {
              const temp = missingInterpolationHandler(str, match, options);
              value = isString$1(temp) ? temp : '';
            } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
              value = '';
            } else if (skipOnVariables) {
              value = match[0];
              continue;
            } else {
              this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
              value = '';
            }
          } else if (!isString$1(value) && !this.useRawValueToEscape) {
            value = makeString(value);
          }
          const safeValue = todo.safeValue(value);
          str = str.replace(match[0], safeValue);
          if (skipOnVariables) {
            todo.regex.lastIndex += value.length;
            todo.regex.lastIndex -= match[0].length;
          } else {
            todo.regex.lastIndex = 0;
          }
          replaces++;
          if (replaces >= this.maxReplaces) {
            break;
          }
        }
      });
      return str;
    }
    nest(str, fc, options = {}) {
      let match;
      let value;
      let clonedOptions;
      const handleHasOptions = (key, inheritedOptions) => {
        const sep = this.nestingOptionsSeparator;
        if (!key.includes(sep)) return key;
        const c = key.split(new RegExp(`${regexEscape(sep)}[ ]*{`));
        let optionsString = `{${c[1]}`;
        key = c[0];
        optionsString = this.interpolate(optionsString, clonedOptions);
        const matchedSingleQuotes = optionsString.match(/'/g);
        const matchedDoubleQuotes = optionsString.match(/"/g);
        if ((matchedSingleQuotes?.length ?? 0) % 2 === 0 && !matchedDoubleQuotes || (matchedDoubleQuotes?.length ?? 0) % 2 !== 0) {
          optionsString = optionsString.replace(/'/g, '"');
        }
        try {
          clonedOptions = JSON.parse(optionsString);
          if (inheritedOptions) clonedOptions = {
            ...inheritedOptions,
            ...clonedOptions
          };
        } catch (e) {
          this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
          return `${key}${sep}${optionsString}`;
        }
        if (clonedOptions.defaultValue && clonedOptions.defaultValue.includes(this.prefix)) delete clonedOptions.defaultValue;
        return key;
      };
      while (match = this.nestingRegexp.exec(str)) {
        let formatters = [];
        clonedOptions = {
          ...options
        };
        clonedOptions = clonedOptions.replace && !isString$1(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
        clonedOptions.applyPostProcessor = false;
        delete clonedOptions.defaultValue;
        const keyEndIndex = /{.*}/.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
        if (keyEndIndex !== -1) {
          formatters = match[1].slice(keyEndIndex).split(this.formatSeparator).map(elem => elem.trim()).filter(Boolean);
          match[1] = match[1].slice(0, keyEndIndex);
        }
        value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
        if (value && match[0] === str && !isString$1(value)) return value;
        if (!isString$1(value)) value = makeString(value);
        if (!value) {
          this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
          value = '';
        }
        if (formatters.length) {
          value = formatters.reduce((v, f) => this.format(v, f, options.lng, {
            ...options,
            interpolationkey: match[1].trim()
          }), value.trim());
        }
        str = str.replace(match[0], value);
        this.regexp.lastIndex = 0;
      }
      return str;
    }
  }
  const parseFormatStr = formatStr => {
    let formatName = formatStr.toLowerCase().trim();
    const formatOptions = {};
    if (formatStr.includes('(')) {
      const p = formatStr.split('(');
      formatName = p[0].toLowerCase().trim();
      const optStr = p[1].slice(0, -1);
      if (formatName === 'currency' && !optStr.includes(':')) {
        if (!formatOptions.currency) formatOptions.currency = optStr.trim();
      } else if (formatName === 'relativetime' && !optStr.includes(':')) {
        if (!formatOptions.range) formatOptions.range = optStr.trim();
      } else {
        const opts = optStr.split(';');
        opts.forEach(opt => {
          if (opt) {
            const [key, ...rest] = opt.split(':');
            const val = rest.join(':').trim().replace(/^'+|'+$/g, '');
            const trimmedKey = key.trim();
            if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
            if (val === 'false') formatOptions[trimmedKey] = false;
            if (val === 'true') formatOptions[trimmedKey] = true;
            if (!isNaN(val)) formatOptions[trimmedKey] = parseInt(val, 10);
          }
        });
      }
    }
    return {
      formatName,
      formatOptions
    };
  };
  const createCachedFormatter = fn => {
    const cache = {};
    return (v, l, o) => {
      let optForCache = o;
      if (o && o.interpolationkey && o.formatParams && o.formatParams[o.interpolationkey] && o[o.interpolationkey]) {
        optForCache = {
          ...optForCache,
          [o.interpolationkey]: undefined
        };
      }
      const key = l + JSON.stringify(optForCache);
      let frm = cache[key];
      if (!frm) {
        frm = fn(getCleanedCode(l), o);
        cache[key] = frm;
      }
      return frm(v);
    };
  };
  const createNonCachedFormatter = fn => (v, l, o) => fn(getCleanedCode(l), o)(v);
  class Formatter {
    constructor(options = {}) {
      this.logger = baseLogger.create('formatter');
      this.options = options;
      this.init(options);
    }
    init(services, options = {
      interpolation: {}
    }) {
      this.formatSeparator = options.interpolation.formatSeparator || ',';
      const cf = options.cacheInBuiltFormats ? createCachedFormatter : createNonCachedFormatter;
      this.formats = {
        number: cf((lng, opt) => {
          const formatter = new Intl.NumberFormat(lng, {
            ...opt
          });
          return val => formatter.format(val);
        }),
        currency: cf((lng, opt) => {
          const formatter = new Intl.NumberFormat(lng, {
            ...opt,
            style: 'currency'
          });
          return val => formatter.format(val);
        }),
        datetime: cf((lng, opt) => {
          const formatter = new Intl.DateTimeFormat(lng, {
            ...opt
          });
          return val => formatter.format(val);
        }),
        relativetime: cf((lng, opt) => {
          const formatter = new Intl.RelativeTimeFormat(lng, {
            ...opt
          });
          return val => formatter.format(val, opt.range || 'day');
        }),
        list: cf((lng, opt) => {
          const formatter = new Intl.ListFormat(lng, {
            ...opt
          });
          return val => formatter.format(val);
        })
      };
    }
    add(name, fc) {
      this.formats[name.toLowerCase().trim()] = fc;
    }
    addCached(name, fc) {
      this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
    }
    format(value, format, lng, options = {}) {
      if (!format) return value;
      if (value == null) return value;
      const formats = format.split(this.formatSeparator);
      if (formats.length > 1 && formats[0].indexOf('(') > 1 && !formats[0].includes(')') && formats.find(f => f.includes(')'))) {
        const lastIndex = formats.findIndex(f => f.includes(')'));
        formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
      }
      const result = formats.reduce((mem, f) => {
        const {
          formatName,
          formatOptions
        } = parseFormatStr(f);
        if (this.formats[formatName]) {
          let formatted = mem;
          try {
            const valOptions = options?.formatParams?.[options.interpolationkey] || {};
            const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
            formatted = this.formats[formatName](mem, l, {
              ...formatOptions,
              ...options,
              ...valOptions
            });
          } catch (error) {
            this.logger.warn(error);
          }
          return formatted;
        } else {
          this.logger.warn(`there was no format function for ${formatName}`);
        }
        return mem;
      }, value);
      return result;
    }
  }
  const removePending = (q, name) => {
    if (q.pending[name] !== undefined) {
      delete q.pending[name];
      q.pendingCount--;
    }
  };
  class Connector extends EventEmitter {
    constructor(backend, store, services, options = {}) {
      super();
      this.backend = backend;
      this.store = store;
      this.services = services;
      this.languageUtils = services.languageUtils;
      this.options = options;
      this.logger = baseLogger.create('backendConnector');
      this.waitingReads = [];
      this.maxParallelReads = options.maxParallelReads || 10;
      this.readingCalls = 0;
      this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
      this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
      this.state = {};
      this.queue = [];
      this.backend?.init?.(services, options.backend, options);
    }
    queueLoad(languages, namespaces, options, callback) {
      const toLoad = {};
      const pending = {};
      const toLoadLanguages = {};
      const toLoadNamespaces = {};
      languages.forEach(lng => {
        let hasAllNamespaces = true;
        namespaces.forEach(ns => {
          const name = `${lng}|${ns}`;
          if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
            this.state[name] = 2;
          } else if (this.state[name] < 0) ;else if (this.state[name] === 1) {
            if (pending[name] === undefined) pending[name] = true;
          } else {
            this.state[name] = 1;
            hasAllNamespaces = false;
            if (pending[name] === undefined) pending[name] = true;
            if (toLoad[name] === undefined) toLoad[name] = true;
            if (toLoadNamespaces[ns] === undefined) toLoadNamespaces[ns] = true;
          }
        });
        if (!hasAllNamespaces) toLoadLanguages[lng] = true;
      });
      if (Object.keys(toLoad).length || Object.keys(pending).length) {
        this.queue.push({
          pending,
          pendingCount: Object.keys(pending).length,
          loaded: {},
          errors: [],
          callback
        });
      }
      return {
        toLoad: Object.keys(toLoad),
        pending: Object.keys(pending),
        toLoadLanguages: Object.keys(toLoadLanguages),
        toLoadNamespaces: Object.keys(toLoadNamespaces)
      };
    }
    loaded(name, err, data) {
      const s = name.split('|');
      const lng = s[0];
      const ns = s[1];
      if (err) this.emit('failedLoading', lng, ns, err);
      if (!err && data) {
        this.store.addResourceBundle(lng, ns, data, undefined, undefined, {
          skipCopy: true
        });
      }
      this.state[name] = err ? -1 : 2;
      if (err && data) this.state[name] = 0;
      const loaded = {};
      this.queue.forEach(q => {
        pushPath(q.loaded, [lng], ns);
        removePending(q, name);
        if (err) q.errors.push(err);
        if (q.pendingCount === 0 && !q.done) {
          Object.keys(q.loaded).forEach(l => {
            if (!loaded[l]) loaded[l] = {};
            const loadedKeys = q.loaded[l];
            if (loadedKeys.length) {
              loadedKeys.forEach(n => {
                if (loaded[l][n] === undefined) loaded[l][n] = true;
              });
            }
          });
          q.done = true;
          if (q.errors.length) {
            q.callback(q.errors);
          } else {
            q.callback();
          }
        }
      });
      this.emit('loaded', loaded);
      this.queue = this.queue.filter(q => !q.done);
    }
    read(lng, ns, fcName, tried = 0, wait = this.retryTimeout, callback) {
      if (!lng.length) return callback(null, {});
      if (this.readingCalls >= this.maxParallelReads) {
        this.waitingReads.push({
          lng,
          ns,
          fcName,
          tried,
          wait,
          callback
        });
        return;
      }
      this.readingCalls++;
      const resolver = (err, data) => {
        this.readingCalls--;
        if (this.waitingReads.length > 0) {
          const next = this.waitingReads.shift();
          this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
        }
        if (err && data && tried < this.maxRetries) {
          setTimeout(() => {
            this.read(lng, ns, fcName, tried + 1, wait * 2, callback);
          }, wait);
          return;
        }
        callback(err, data);
      };
      const fc = this.backend[fcName].bind(this.backend);
      if (fc.length === 2) {
        try {
          const r = fc(lng, ns);
          if (r && typeof r.then === 'function') {
            r.then(data => resolver(null, data)).catch(resolver);
          } else {
            resolver(null, r);
          }
        } catch (err) {
          resolver(err);
        }
        return;
      }
      return fc(lng, ns, resolver);
    }
    prepareLoading(languages, namespaces, options = {}, callback) {
      if (!this.backend) {
        this.logger.warn('No backend was added via i18next.use. Will not load resources.');
        return callback && callback();
      }
      if (isString$1(languages)) languages = this.languageUtils.toResolveHierarchy(languages);
      if (isString$1(namespaces)) namespaces = [namespaces];
      const toLoad = this.queueLoad(languages, namespaces, options, callback);
      if (!toLoad.toLoad.length) {
        if (!toLoad.pending.length) callback();
        return null;
      }
      toLoad.toLoad.forEach(name => {
        this.loadOne(name);
      });
    }
    load(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {}, callback);
    }
    reload(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {
        reload: true
      }, callback);
    }
    loadOne(name, prefix = '') {
      const s = name.split('|');
      const lng = s[0];
      const ns = s[1];
      this.read(lng, ns, 'read', undefined, undefined, (err, data) => {
        if (err) this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
        if (!err && data) this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
        this.loaded(name, err, data);
      });
    }
    saveMissing(languages, namespace, key, fallbackValue, isUpdate, options = {}, clb = () => {}) {
      if (this.services?.utils?.hasLoadedNamespace && !this.services?.utils?.hasLoadedNamespace(namespace)) {
        this.logger.warn(`did not save key "${key}" as the namespace "${namespace}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
        return;
      }
      if (key === undefined || key === null || key === '') return;
      if (this.backend?.create) {
        const opts = {
          ...options,
          isUpdate
        };
        const fc = this.backend.create.bind(this.backend);
        if (fc.length < 6) {
          try {
            let r;
            if (fc.length === 5) {
              r = fc(languages, namespace, key, fallbackValue, opts);
            } else {
              r = fc(languages, namespace, key, fallbackValue);
            }
            if (r && typeof r.then === 'function') {
              r.then(data => clb(null, data)).catch(clb);
            } else {
              clb(null, r);
            }
          } catch (err) {
            clb(err);
          }
        } else {
          fc(languages, namespace, key, fallbackValue, clb, opts);
        }
      }
      if (!languages || !languages[0]) return;
      this.store.addResource(languages[0], namespace, key, fallbackValue);
    }
  }
  const get = () => ({
    debug: false,
    initAsync: true,
    ns: ['translation'],
    defaultNS: ['translation'],
    fallbackLng: ['dev'],
    fallbackNS: false,
    supportedLngs: false,
    nonExplicitSupportedLngs: false,
    load: 'all',
    preload: false,
    keySeparator: '.',
    nsSeparator: ':',
    pluralSeparator: '_',
    contextSeparator: '_',
    partialBundledLanguages: false,
    saveMissing: false,
    updateMissing: false,
    saveMissingTo: 'fallback',
    saveMissingPlurals: true,
    missingKeyHandler: false,
    missingInterpolationHandler: false,
    postProcess: false,
    postProcessPassResolved: false,
    returnNull: false,
    returnEmptyString: true,
    returnObjects: false,
    joinArrays: false,
    returnedObjectHandler: false,
    parseMissingKeyHandler: false,
    appendNamespaceToMissingKey: false,
    appendNamespaceToCIMode: false,
    overloadTranslationOptionHandler: args => {
      let ret = {};
      if (typeof args[1] === 'object') ret = args[1];
      if (isString$1(args[1])) ret.defaultValue = args[1];
      if (isString$1(args[2])) ret.tDescription = args[2];
      if (typeof args[2] === 'object' || typeof args[3] === 'object') {
        const options = args[3] || args[2];
        Object.keys(options).forEach(key => {
          ret[key] = options[key];
        });
      }
      return ret;
    },
    interpolation: {
      escapeValue: true,
      prefix: '{{',
      suffix: '}}',
      formatSeparator: ',',
      unescapePrefix: '-',
      nestingPrefix: '$t(',
      nestingSuffix: ')',
      nestingOptionsSeparator: ',',
      maxReplaces: 1000,
      skipOnVariables: true
    },
    cacheInBuiltFormats: true
  });
  const transformOptions = options => {
    if (isString$1(options.ns)) options.ns = [options.ns];
    if (isString$1(options.fallbackLng)) options.fallbackLng = [options.fallbackLng];
    if (isString$1(options.fallbackNS)) options.fallbackNS = [options.fallbackNS];
    if (options.supportedLngs && !options.supportedLngs.includes('cimode')) {
      options.supportedLngs = options.supportedLngs.concat(['cimode']);
    }
    return options;
  };
  const noop = () => {};
  const bindMemberFunctions = inst => {
    const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
    mems.forEach(mem => {
      if (typeof inst[mem] === 'function') {
        inst[mem] = inst[mem].bind(inst);
      }
    });
  };
  class I18n extends EventEmitter {
    constructor(options = {}, callback) {
      super();
      this.options = transformOptions(options);
      this.services = {};
      this.logger = baseLogger;
      this.modules = {
        external: []
      };
      bindMemberFunctions(this);
      if (callback && !this.isInitialized && !options.isClone) {
        if (!this.options.initAsync) {
          this.init(options, callback);
          return this;
        }
        setTimeout(() => {
          this.init(options, callback);
        }, 0);
      }
    }
    init(options = {}, callback) {
      this.isInitializing = true;
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (options.defaultNS == null && options.ns) {
        if (isString$1(options.ns)) {
          options.defaultNS = options.ns;
        } else if (!options.ns.includes('translation')) {
          options.defaultNS = options.ns[0];
        }
      }
      const defOpts = get();
      this.options = {
        ...defOpts,
        ...this.options,
        ...transformOptions(options)
      };
      this.options.interpolation = {
        ...defOpts.interpolation,
        ...this.options.interpolation
      };
      if (options.keySeparator !== undefined) {
        this.options.userDefinedKeySeparator = options.keySeparator;
      }
      if (options.nsSeparator !== undefined) {
        this.options.userDefinedNsSeparator = options.nsSeparator;
      }
      if (typeof this.options.overloadTranslationOptionHandler !== 'function') {
        this.options.overloadTranslationOptionHandler = defOpts.overloadTranslationOptionHandler;
      }
      const createClassOnDemand = ClassOrObject => {
        if (!ClassOrObject) return null;
        if (typeof ClassOrObject === 'function') return new ClassOrObject();
        return ClassOrObject;
      };
      if (!this.options.isClone) {
        if (this.modules.logger) {
          baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
        } else {
          baseLogger.init(null, this.options);
        }
        let formatter;
        if (this.modules.formatter) {
          formatter = this.modules.formatter;
        } else {
          formatter = Formatter;
        }
        const lu = new LanguageUtil(this.options);
        this.store = new ResourceStore(this.options.resources, this.options);
        const s = this.services;
        s.logger = baseLogger;
        s.resourceStore = this.store;
        s.languageUtils = lu;
        s.pluralResolver = new PluralResolver(lu, {
          prepend: this.options.pluralSeparator
        });
        if (formatter) {
          s.formatter = createClassOnDemand(formatter);
          if (s.formatter.init) s.formatter.init(s, this.options);
          this.options.interpolation.format = s.formatter.format.bind(s.formatter);
        }
        s.interpolator = new Interpolator(this.options);
        s.utils = {
          hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
        };
        s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
        s.backendConnector.on('*', (event, ...args) => {
          this.emit(event, ...args);
        });
        if (this.modules.languageDetector) {
          s.languageDetector = createClassOnDemand(this.modules.languageDetector);
          if (s.languageDetector.init) s.languageDetector.init(s, this.options.detection, this.options);
        }
        if (this.modules.i18nFormat) {
          s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
          if (s.i18nFormat.init) s.i18nFormat.init(this);
        }
        this.translator = new Translator(this.services, this.options);
        this.translator.on('*', (event, ...args) => {
          this.emit(event, ...args);
        });
        this.modules.external.forEach(m => {
          if (m.init) m.init(this);
        });
      }
      this.format = this.options.interpolation.format;
      if (!callback) callback = noop;
      if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
        const codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
        if (codes.length > 0 && codes[0] !== 'dev') this.options.lng = codes[0];
      }
      if (!this.services.languageDetector && !this.options.lng) {
        this.logger.warn('init: no languageDetector is used and no lng is defined');
      }
      const storeApi = ['getResource', 'hasResourceBundle', 'getResourceBundle', 'getDataByLanguage'];
      storeApi.forEach(fcName => {
        this[fcName] = (...args) => this.store[fcName](...args);
      });
      const storeApiChained = ['addResource', 'addResources', 'addResourceBundle', 'removeResourceBundle'];
      storeApiChained.forEach(fcName => {
        this[fcName] = (...args) => {
          this.store[fcName](...args);
          return this;
        };
      });
      const deferred = defer();
      const load = () => {
        const finish = (err, t) => {
          this.isInitializing = false;
          if (this.isInitialized && !this.initializedStoreOnce) this.logger.warn('init: i18next is already initialized. You should call init just once!');
          this.isInitialized = true;
          if (!this.options.isClone) this.logger.log('initialized', this.options);
          this.emit('initialized', this.options);
          deferred.resolve(t);
          callback(err, t);
        };
        if ((this.languages || this.isLanguageChangingTo) && !this.isInitialized) return finish(null, this.t.bind(this));
        this.changeLanguage(this.options.lng, finish);
      };
      if (this.options.resources || !this.options.initAsync) {
        load();
      } else {
        setTimeout(load, 0);
      }
      return deferred;
    }
    loadResources(language, callback = noop) {
      let usedCallback = callback;
      const usedLng = isString$1(language) ? language : this.language;
      if (typeof language === 'function') usedCallback = language;
      if (!this.options.resources || this.options.partialBundledLanguages) {
        if (usedLng?.toLowerCase() === 'cimode' && (!this.options.preload || this.options.preload.length === 0)) return usedCallback();
        const toLoad = [];
        const append = lng => {
          if (!lng) return;
          if (lng === 'cimode') return;
          const lngs = this.services.languageUtils.toResolveHierarchy(lng);
          lngs.forEach(l => {
            if (l === 'cimode') return;
            if (!toLoad.includes(l)) toLoad.push(l);
          });
        };
        if (!usedLng) {
          const fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
          fallbacks.forEach(l => append(l));
        } else {
          append(usedLng);
        }
        this.options.preload?.forEach?.(l => append(l));
        this.services.backendConnector.load(toLoad, this.options.ns, e => {
          if (!e && !this.resolvedLanguage && this.language) this.setResolvedLanguage(this.language);
          usedCallback(e);
        });
      } else {
        usedCallback(null);
      }
    }
    reloadResources(lngs, ns, callback) {
      const deferred = defer();
      if (typeof lngs === 'function') {
        callback = lngs;
        lngs = undefined;
      }
      if (typeof ns === 'function') {
        callback = ns;
        ns = undefined;
      }
      if (!lngs) lngs = this.languages;
      if (!ns) ns = this.options.ns;
      if (!callback) callback = noop;
      this.services.backendConnector.reload(lngs, ns, err => {
        deferred.resolve();
        callback(err);
      });
      return deferred;
    }
    use(module) {
      if (!module) throw new Error('You are passing an undefined module! Please check the object you are passing to i18next.use()');
      if (!module.type) throw new Error('You are passing a wrong module! Please check the object you are passing to i18next.use()');
      if (module.type === 'backend') {
        this.modules.backend = module;
      }
      if (module.type === 'logger' || module.log && module.warn && module.error) {
        this.modules.logger = module;
      }
      if (module.type === 'languageDetector') {
        this.modules.languageDetector = module;
      }
      if (module.type === 'i18nFormat') {
        this.modules.i18nFormat = module;
      }
      if (module.type === 'postProcessor') {
        postProcessor.addPostProcessor(module);
      }
      if (module.type === 'formatter') {
        this.modules.formatter = module;
      }
      if (module.type === '3rdParty') {
        this.modules.external.push(module);
      }
      return this;
    }
    setResolvedLanguage(l) {
      if (!l || !this.languages) return;
      if (['cimode', 'dev'].includes(l)) return;
      for (let li = 0; li < this.languages.length; li++) {
        const lngInLngs = this.languages[li];
        if (['cimode', 'dev'].includes(lngInLngs)) continue;
        if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
          this.resolvedLanguage = lngInLngs;
          break;
        }
      }
      if (!this.resolvedLanguage && !this.languages.includes(l) && this.store.hasLanguageSomeTranslations(l)) {
        this.resolvedLanguage = l;
        this.languages.unshift(l);
      }
    }
    changeLanguage(lng, callback) {
      this.isLanguageChangingTo = lng;
      const deferred = defer();
      this.emit('languageChanging', lng);
      const setLngProps = l => {
        this.language = l;
        this.languages = this.services.languageUtils.toResolveHierarchy(l);
        this.resolvedLanguage = undefined;
        this.setResolvedLanguage(l);
      };
      const done = (err, l) => {
        if (l) {
          if (this.isLanguageChangingTo === lng) {
            setLngProps(l);
            this.translator.changeLanguage(l);
            this.isLanguageChangingTo = undefined;
            this.emit('languageChanged', l);
            this.logger.log('languageChanged', l);
          }
        } else {
          this.isLanguageChangingTo = undefined;
        }
        deferred.resolve((...args) => this.t(...args));
        if (callback) callback(err, (...args) => this.t(...args));
      };
      const setLng = lngs => {
        if (!lng && !lngs && this.services.languageDetector) lngs = [];
        const fl = isString$1(lngs) ? lngs : lngs && lngs[0];
        const l = this.store.hasLanguageSomeTranslations(fl) ? fl : this.services.languageUtils.getBestMatchFromCodes(isString$1(lngs) ? [lngs] : lngs);
        if (l) {
          if (!this.language) {
            setLngProps(l);
          }
          if (!this.translator.language) this.translator.changeLanguage(l);
          this.services.languageDetector?.cacheUserLanguage?.(l);
        }
        this.loadResources(l, err => {
          done(err, l);
        });
      };
      if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
        setLng(this.services.languageDetector.detect());
      } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
        if (this.services.languageDetector.detect.length === 0) {
          this.services.languageDetector.detect().then(setLng);
        } else {
          this.services.languageDetector.detect(setLng);
        }
      } else {
        setLng(lng);
      }
      return deferred;
    }
    getFixedT(lng, ns, keyPrefix, fixedOpts) {
      const scopeNs = fixedOpts?.scopeNs;
      const fixedT = (key, opts, ...rest) => {
        let o;
        if (typeof opts !== 'object') {
          o = this.options.overloadTranslationOptionHandler([key, opts].concat(rest));
        } else {
          o = {
            ...opts
          };
        }
        o.lng = o.lng || fixedT.lng;
        o.lngs = o.lngs || fixedT.lngs;
        const explicitCallNs = o.ns !== undefined && o.ns !== null;
        o.ns = o.ns || fixedT.ns;
        if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || fixedT.keyPrefix;
        const selectorOpts = {
          ...this.options,
          ...o
        };
        if (Array.isArray(scopeNs) && !explicitCallNs) selectorOpts.ns = scopeNs;
        if (typeof o.keyPrefix === 'function') o.keyPrefix = keysFromSelector(o.keyPrefix, selectorOpts);
        const keySeparator = this.options.keySeparator || '.';
        let resultKey;
        if (o.keyPrefix && Array.isArray(key)) {
          resultKey = key.map(k => {
            if (typeof k === 'function') k = keysFromSelector(k, selectorOpts);
            return `${o.keyPrefix}${keySeparator}${k}`;
          });
        } else {
          if (typeof key === 'function') key = keysFromSelector(key, selectorOpts);
          resultKey = o.keyPrefix ? `${o.keyPrefix}${keySeparator}${key}` : key;
        }
        return this.t(resultKey, o);
      };
      if (isString$1(lng)) {
        fixedT.lng = lng;
      } else {
        fixedT.lngs = lng;
      }
      fixedT.ns = ns;
      fixedT.keyPrefix = keyPrefix;
      return fixedT;
    }
    t(...args) {
      return this.translator?.translate(...args);
    }
    exists(...args) {
      return this.translator?.exists(...args);
    }
    setDefaultNamespace(ns) {
      this.options.defaultNS = ns;
    }
    hasLoadedNamespace(ns, options = {}) {
      if (!this.isInitialized) {
        this.logger.warn('hasLoadedNamespace: i18next was not initialized', this.languages);
        return false;
      }
      if (!this.languages || !this.languages.length) {
        this.logger.warn('hasLoadedNamespace: i18n.languages were undefined or empty', this.languages);
        return false;
      }
      const lng = options.lng || this.resolvedLanguage || this.languages[0];
      const fallbackLng = this.options ? this.options.fallbackLng : false;
      const lastLng = this.languages[this.languages.length - 1];
      if (lng.toLowerCase() === 'cimode') return true;
      const loadNotPending = (l, n) => {
        const loadState = this.services.backendConnector.state[`${l}|${n}`];
        return loadState === -1 || loadState === 0 || loadState === 2;
      };
      if (options.precheck) {
        const preResult = options.precheck(this, loadNotPending);
        if (preResult !== undefined) return preResult;
      }
      if (this.hasResourceBundle(lng, ns)) return true;
      if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return true;
      if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;
      return false;
    }
    loadNamespaces(ns, callback) {
      const deferred = defer();
      if (!this.options.ns) {
        if (callback) callback();
        return Promise.resolve();
      }
      if (isString$1(ns)) ns = [ns];
      ns.forEach(n => {
        if (!this.options.ns.includes(n)) this.options.ns.push(n);
      });
      this.loadResources(err => {
        deferred.resolve();
        if (callback) callback(err);
      });
      return deferred;
    }
    loadLanguages(lngs, callback) {
      const deferred = defer();
      if (isString$1(lngs)) lngs = [lngs];
      const preloaded = this.options.preload || [];
      const newLngs = lngs.filter(lng => !preloaded.includes(lng) && this.services.languageUtils.isSupportedCode(lng));
      if (!newLngs.length) {
        if (callback) callback();
        return Promise.resolve();
      }
      this.options.preload = preloaded.concat(newLngs);
      this.loadResources(err => {
        deferred.resolve();
        if (callback) callback(err);
      });
      return deferred;
    }
    dir(lng) {
      if (!lng) lng = this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language);
      if (!lng) return 'rtl';
      try {
        const l = new Intl.Locale(lng);
        if (l && l.getTextInfo) {
          const ti = l.getTextInfo();
          if (ti && ti.direction) return ti.direction;
        }
      } catch (e) {}
      const rtlLngs = ['ar', 'shu', 'sqr', 'ssh', 'xaa', 'yhd', 'yud', 'aao', 'abh', 'abv', 'acm', 'acq', 'acw', 'acx', 'acy', 'adf', 'ads', 'aeb', 'aec', 'afb', 'ajp', 'apc', 'apd', 'arb', 'arq', 'ars', 'ary', 'arz', 'auz', 'avl', 'ayh', 'ayl', 'ayn', 'ayp', 'bbz', 'pga', 'he', 'iw', 'ps', 'pbt', 'pbu', 'pst', 'prp', 'prd', 'ug', 'ur', 'ydd', 'yds', 'yih', 'ji', 'yi', 'hbo', 'men', 'xmn', 'fa', 'jpr', 'peo', 'pes', 'prs', 'dv', 'sam', 'ckb'];
      const languageUtils = this.services?.languageUtils || new LanguageUtil(get());
      if (lng.toLowerCase().indexOf('-latn') > 1) return 'ltr';
      return rtlLngs.includes(languageUtils.getLanguagePartFromCode(lng)) || lng.toLowerCase().indexOf('-arab') > 1 ? 'rtl' : 'ltr';
    }
    static createInstance(options = {}, callback) {
      const instance = new I18n(options, callback);
      instance.createInstance = I18n.createInstance;
      return instance;
    }
    cloneInstance(options = {}, callback = noop) {
      const forkResourceStore = options.forkResourceStore;
      if (forkResourceStore) delete options.forkResourceStore;
      const mergedOptions = {
        ...this.options,
        ...options,
        ...{
          isClone: true
        }
      };
      const clone = new I18n(mergedOptions);
      if (options.debug !== undefined || options.prefix !== undefined) {
        clone.logger = clone.logger.clone(options);
      }
      const membersToCopy = ['store', 'services', 'language'];
      membersToCopy.forEach(m => {
        clone[m] = this[m];
      });
      clone.services = {
        ...this.services
      };
      clone.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      if (forkResourceStore) {
        const clonedData = Object.keys(this.store.data).reduce((prev, l) => {
          prev[l] = {
            ...this.store.data[l]
          };
          prev[l] = Object.keys(prev[l]).reduce((acc, n) => {
            acc[n] = {
              ...prev[l][n]
            };
            return acc;
          }, prev[l]);
          return prev;
        }, {});
        clone.store = new ResourceStore(clonedData, mergedOptions);
        clone.services.resourceStore = clone.store;
      }
      if (options.interpolation) {
        const defOpts = get();
        const mergedInterpolation = {
          ...defOpts.interpolation,
          ...this.options.interpolation,
          ...options.interpolation
        };
        const mergedForInterpolator = {
          ...mergedOptions,
          interpolation: mergedInterpolation
        };
        clone.services.interpolator = new Interpolator(mergedForInterpolator);
      }
      clone.translator = new Translator(clone.services, mergedOptions);
      clone.translator.on('*', (event, ...args) => {
        clone.emit(event, ...args);
      });
      clone.init(mergedOptions, callback);
      clone.translator.options = mergedOptions;
      clone.translator.backendConnector.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      return clone;
    }
    toJSON() {
      return {
        options: this.options,
        store: this.store,
        language: this.language,
        languages: this.languages,
        resolvedLanguage: this.resolvedLanguage
      };
    }
  }
  const instance = I18n.createInstance();
  instance.createInstance;
  instance.dir;
  instance.init;
  instance.loadResources;
  instance.reloadResources;
  instance.use;
  instance.changeLanguage;
  instance.getFixedT;
  instance.t;
  instance.exists;
  instance.setDefaultNamespace;
  instance.hasLoadedNamespace;
  instance.loadNamespaces;
  instance.loadLanguages;

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  var voidElements;
  var hasRequiredVoidElements;

  function requireVoidElements () {
  	if (hasRequiredVoidElements) return voidElements;
  	hasRequiredVoidElements = 1;
  	voidElements = {
  	  "area": true,
  	  "base": true,
  	  "br": true,
  	  "col": true,
  	  "embed": true,
  	  "hr": true,
  	  "img": true,
  	  "input": true,
  	  "link": true,
  	  "meta": true,
  	  "param": true,
  	  "source": true,
  	  "track": true,
  	  "wbr": true
  	};
  	return voidElements;
  }

  var voidElementsExports = requireVoidElements();
  var e = /*@__PURE__*/getDefaultExportFromCjs(voidElementsExports);

  var t = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?(".*?"|'.*?')/g;
  function n(n) {
    var r = {
        type: "tag",
        name: "",
        voidElement: false,
        attrs: {},
        children: []
      },
      i = n.match(/<\/?([^\s]+?)[/\s>]/);
    if (i && (r.name = i[1], (e[i[1]] || "/" === n.charAt(n.length - 2)) && (r.voidElement = true), r.name.startsWith("!--"))) {
      var s = n.indexOf("--\x3e");
      return {
        type: "comment",
        comment: -1 !== s ? n.slice(4, s) : ""
      };
    }
    for (var a = new RegExp(t), c = null; null !== (c = a.exec(n));) if (c[0].trim()) if (c[1]) {
      var o = c[1].trim(),
        l = [o, ""];
      o.indexOf("=") > -1 && (l = o.split("=")), r.attrs[l[0]] = l[1], a.lastIndex--;
    } else c[2] && (r.attrs[c[2]] = c[3].trim().substring(1, c[3].length - 1));
    return r;
  }
  var r = /<[a-zA-Z0-9\-\!\/](?:"[^"]*"|'[^']*'|[^'">])*>/g,
    i = /^\s*$/,
    s = Object.create(null);
  function a(e, t) {
    switch (t.type) {
      case "text":
        return e + t.content;
      case "tag":
        return e += "<" + t.name + (t.attrs ? function (e) {
          var t = [];
          for (var n in e) t.push(n + '="' + e[n] + '"');
          return t.length ? " " + t.join(" ") : "";
        }(t.attrs) : "") + (t.voidElement ? "/>" : ">"), t.voidElement ? e : e + t.children.reduce(a, "") + "</" + t.name + ">";
      case "comment":
        return e + "\x3c!--" + t.comment + "--\x3e";
    }
  }
  var c = {
    parse: function (e, t) {
      t || (t = {}), t.components || (t.components = s);
      var a,
        c = [],
        o = [],
        l = -1,
        m = false;
      if (0 !== e.indexOf("<")) {
        var u = e.indexOf("<");
        c.push({
          type: "text",
          content: -1 === u ? e : e.substring(0, u)
        });
      }
      return e.replace(r, function (r, s) {
        if (m) {
          if (r !== "</" + a.name + ">") return;
          m = false;
        }
        var u,
          f = "/" !== r.charAt(1),
          h = r.startsWith("\x3c!--"),
          p = s + r.length,
          d = e.charAt(p);
        if (h) {
          var v = n(r);
          return l < 0 ? (c.push(v), c) : ((u = o[l]).children.push(v), c);
        }
        if (f && (l++, "tag" === (a = n(r)).type && t.components[a.name] && (a.type = "component", m = true), a.voidElement || m || !d || "<" === d || a.children.push({
          type: "text",
          content: e.slice(p, e.indexOf("<", p))
        }), 0 === l && c.push(a), (u = o[l - 1]) && u.children.push(a), o[l] = a), (!f || a.voidElement) && (l > -1 && (a.voidElement || a.name === r.slice(2, -1)) && (l--, a = -1 === l ? c : o[l]), !m && "<" !== d && d)) {
          u = -1 === l ? c : o[l].children;
          var x = e.indexOf("<", p),
            g = e.slice(p, -1 === x ? void 0 : x);
          i.test(g) && (g = " "), (x > -1 && l + u.length >= 0 || " " !== g) && u.push({
            type: "text",
            content: g
          });
        }
      }), c;
    },
    stringify: function (e) {
      return e.reduce(function (e, t) {
        return e + a("", t);
      }, "");
    }
  };

  const warn = (i18n, code, msg, rest) => {
    const args = [msg, {
      code,
      ...(rest || {})
    }];
    if (i18n?.services?.logger?.forward) {
      return i18n.services.logger.forward(args, 'warn', 'react-i18next::', true);
    }
    if (isString(args[0])) args[0] = `react-i18next:: ${args[0]}`;
    if (i18n?.services?.logger?.warn) {
      i18n.services.logger.warn(...args);
    } else if (console?.warn) {
      console.warn(...args);
    }
  };
  const alreadyWarned = {};
  const warnOnce = (i18n, code, msg, rest) => {
    if (isString(msg) && alreadyWarned[msg]) return;
    if (isString(msg)) alreadyWarned[msg] = new Date();
    warn(i18n, code, msg, rest);
  };
  const loadedClb = (i18n, cb) => () => {
    if (i18n.isInitialized) {
      cb();
    } else {
      const initialized = () => {
        setTimeout(() => {
          i18n.off('initialized', initialized);
        }, 0);
        cb();
      };
      i18n.on('initialized', initialized);
    }
  };
  const loadNamespaces = (i18n, ns, cb) => {
    i18n.loadNamespaces(ns, loadedClb(i18n, cb));
  };
  const loadLanguages = (i18n, lng, ns, cb) => {
    if (isString(ns)) ns = [ns];
    if (i18n.options.preload && i18n.options.preload.indexOf(lng) > -1) return loadNamespaces(i18n, ns, cb);
    ns.forEach(n => {
      if (i18n.options.ns.indexOf(n) < 0) i18n.options.ns.push(n);
    });
    i18n.loadLanguages(lng, loadedClb(i18n, cb));
  };
  const hasLoadedNamespace = (ns, i18n, options = {}) => {
    if (!i18n.languages || !i18n.languages.length) {
      warnOnce(i18n, 'NO_LANGUAGES', 'i18n.languages were undefined or empty', {
        languages: i18n.languages
      });
      return true;
    }
    return i18n.hasLoadedNamespace(ns, {
      lng: options.lng,
      precheck: (i18nInstance, loadNotPending) => {
        if (options.bindI18n && options.bindI18n.indexOf('languageChanging') > -1 && i18nInstance.services.backendConnector.backend && i18nInstance.isLanguageChangingTo && !loadNotPending(i18nInstance.isLanguageChangingTo, ns)) return false;
      }
    });
  };
  const getDisplayName = Component => Component.displayName || Component.name || (isString(Component) && Component.length > 0 ? Component : 'Unknown');
  const isString = obj => typeof obj === 'string';
  const isObject = obj => typeof obj === 'object' && obj !== null;

  const matchHtmlEntity = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160|copy|#169|reg|#174|hellip|#8230|#x2F|#47);/g;
  const htmlEntities = {
    '&amp;': '&',
    '&#38;': '&',
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&#34;': '"',
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&copy;': '©',
    '&#169;': '©',
    '&reg;': '®',
    '&#174;': '®',
    '&hellip;': '…',
    '&#8230;': '…',
    '&#x2F;': '/',
    '&#47;': '/'
  };
  const unescapeHtmlEntity = m => htmlEntities[m];
  const unescape = text => text.replace(matchHtmlEntity, unescapeHtmlEntity);

  let defaultOptions = {
    bindI18n: 'languageChanged',
    bindI18nStore: '',
    transEmptyNodeValue: '',
    transSupportBasicHtmlNodes: true,
    transWrapTextNodes: '',
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
    useSuspense: true,
    unescape,
    transDefaultProps: undefined
  };
  const setDefaults = (options = {}) => {
    defaultOptions = {
      ...defaultOptions,
      ...options
    };
  };
  const getDefaults = () => defaultOptions;

  let i18nInstance;
  const setI18n = instance => {
    i18nInstance = instance;
  };
  const getI18n = () => i18nInstance;

  const hasChildren = (node, checkLength) => {
    if (!node) return false;
    const base = node.props?.children ?? node.children;
    if (checkLength) return base.length > 0;
    return !!base;
  };
  const getChildren = node => {
    if (!node) return [];
    const children = node.props?.children ?? node.children;
    return node.props?.i18nIsDynamicList ? getAsArray(children) : children;
  };
  const hasValidReactChildren = children => Array.isArray(children) && children.every(React.isValidElement);
  const getAsArray = data => Array.isArray(data) ? data : [data];
  const mergeProps = (source, target) => {
    const newTarget = {
      ...target
    };
    newTarget.props = {
      ...target.props,
      ...source.props
    };
    return newTarget;
  };
  const getValuesFromChildren = children => {
    const values = {};
    if (!children) return values;
    const getData = childs => {
      const childrenArray = getAsArray(childs);
      childrenArray.forEach(child => {
        if (isString(child)) return;
        if (hasChildren(child)) getData(getChildren(child));else if (isObject(child) && !React.isValidElement(child)) Object.assign(values, child);
      });
    };
    getData(children);
    return values;
  };
  const nodesToString = (children, i18nOptions, i18n, i18nKey) => {
    if (!children) return '';
    let stringNode = '';
    const childrenArray = getAsArray(children);
    const keepArray = i18nOptions?.transSupportBasicHtmlNodes ? i18nOptions.transKeepBasicHtmlNodesFor ?? [] : [];
    childrenArray.forEach((child, childIndex) => {
      if (isString(child)) {
        stringNode += `${child}`;
        return;
      }
      if (React.isValidElement(child)) {
        const {
          props,
          type
        } = child;
        const childPropsCount = Object.keys(props).length;
        const shouldKeepChild = keepArray.indexOf(type) > -1;
        const childChildren = props.children;
        if (!childChildren && shouldKeepChild && !childPropsCount) {
          stringNode += `<${type}/>`;
          return;
        }
        if (!childChildren && (!shouldKeepChild || childPropsCount) || props.i18nIsDynamicList) {
          stringNode += `<${childIndex}></${childIndex}>`;
          return;
        }
        if (shouldKeepChild && childPropsCount <= 1) {
          const cnt = isString(childChildren) ? childChildren : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
          stringNode += `<${type}>${cnt}</${type}>`;
          return;
        }
        const content = nodesToString(childChildren, i18nOptions, i18n, i18nKey);
        stringNode += `<${childIndex}>${content}</${childIndex}>`;
        return;
      }
      if (child === null) {
        warn(i18n, 'TRANS_NULL_VALUE', `Passed in a null value as child`, {
          i18nKey
        });
        return;
      }
      if (isObject(child)) {
        const {
          format,
          ...clone
        } = child;
        const keys = Object.keys(clone);
        if (keys.length === 1) {
          const value = format ? `${keys[0]}, ${format}` : keys[0];
          stringNode += `{{${value}}}`;
          return;
        }
        warn(i18n, 'TRANS_INVALID_OBJ', `Invalid child - Object should only have keys {{ value, format }} (format is optional).`, {
          i18nKey,
          child
        });
        return;
      }
      warn(i18n, 'TRANS_INVALID_VAR', `Passed in a variable like {number} - pass variables for interpolation as full objects like {{number}}.`, {
        i18nKey,
        child
      });
    });
    return stringNode;
  };
  const escapeLiteralLessThan = (str, keepArray = [], knownComponentsMap = {}) => {
    if (!str) return str;
    const knownNames = Object.keys(knownComponentsMap);
    const allValidNames = [...keepArray, ...knownNames];
    let result = '';
    let i = 0;
    while (i < str.length) {
      if (str[i] === '<') {
        let isValidTag = false;
        const closingMatch = str.slice(i).match(/^<\/(\d+|[a-zA-Z][a-zA-Z0-9_-]*)>/);
        if (closingMatch) {
          const tagName = closingMatch[1];
          if (/^\d+$/.test(tagName) || allValidNames.includes(tagName)) {
            isValidTag = true;
            result += closingMatch[0];
            i += closingMatch[0].length;
          }
        }
        if (!isValidTag) {
          const openingMatch = str.slice(i).match(/^<(\d+|[a-zA-Z][a-zA-Z0-9_-]*)(\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*(\/)?>/);
          if (openingMatch) {
            const tagName = openingMatch[1];
            if (/^\d+$/.test(tagName) || allValidNames.includes(tagName)) {
              isValidTag = true;
              result += openingMatch[0];
              i += openingMatch[0].length;
            }
          }
        }
        if (!isValidTag) {
          result += '&lt;';
          i += 1;
        }
      } else {
        result += str[i];
        i += 1;
      }
    }
    return result;
  };
  const renderNodes = (children, knownComponentsMap, targetString, i18n, i18nOptions, combinedTOpts, shouldUnescape) => {
    if (targetString === '') return [];
    const keepArray = i18nOptions.transKeepBasicHtmlNodesFor || [];
    const emptyChildrenButNeedsHandling = targetString && new RegExp(keepArray.map(keep => `<${keep}`).join('|')).test(targetString);
    if (!children && !knownComponentsMap && !emptyChildrenButNeedsHandling && !shouldUnescape) return [targetString];
    const data = knownComponentsMap ?? {};
    const getData = childs => {
      const childrenArray = getAsArray(childs);
      childrenArray.forEach(child => {
        if (isString(child)) return;
        if (hasChildren(child)) getData(getChildren(child));else if (isObject(child) && !React.isValidElement(child)) Object.assign(data, child);
      });
    };
    getData(children);
    const escapedString = escapeLiteralLessThan(targetString, keepArray, data);
    const ast = c.parse(`<0>${escapedString}</0>`);
    const opts = {
      ...data,
      ...combinedTOpts
    };
    const renderInner = (child, node, rootReactNode) => {
      const childs = getChildren(child);
      const mappedChildren = mapAST(childs, node.children, rootReactNode);
      return hasValidReactChildren(childs) && mappedChildren.length === 0 || child.props?.i18nIsDynamicList ? childs : mappedChildren;
    };
    const pushTranslatedJSX = (child, inner, mem, i, isVoid) => {
      if (child.dummy) {
        child.children = inner;
        mem.push(React.cloneElement(child, {
          key: i
        }, isVoid ? undefined : inner));
      } else {
        mem.push(...React.Children.map([child], c => {
          if (c.type === React.Fragment || c.props?.i18nIsDynamicList !== undefined) {
            const freshProps = {
              key: i
            };
            if (c && c.props) {
              Object.keys(c.props).forEach(k => {
                if (k === 'children' || k === 'i18nIsDynamicList') return;
                freshProps[k] = c.props[k];
              });
            }
            return React.createElement(c.type, freshProps, isVoid ? null : inner);
          }
          const override = {
            key: i
          };
          if (c && c.props) {
            Object.keys(c.props).forEach(k => {
              if (k === 'ref' || k === 'children') return;
              override[k] = c.props[k];
            });
          }
          return React.cloneElement(c, override, isVoid ? null : inner);
        }));
      }
    };
    const mapAST = (reactNode, astNode, rootReactNode) => {
      const reactNodes = getAsArray(reactNode);
      const astNodes = getAsArray(astNode);
      const keepTagOccurrence = {};
      return astNodes.reduce((mem, node, i) => {
        const translationContent = node.children?.[0]?.content && i18n.services.interpolator.interpolate(node.children[0].content, opts, i18n.language);
        if (node.type === 'tag') {
          let tmp = reactNodes[parseInt(node.name, 10)];
          if (!tmp && knownComponentsMap) tmp = knownComponentsMap[node.name];
          if (rootReactNode.length === 1 && !tmp) tmp = rootReactNode[0][node.name];
          if (!tmp) tmp = {};
          const props = {
            ...node.attrs
          };
          if (shouldUnescape) {
            Object.keys(props).forEach(p => {
              const val = props[p];
              if (isString(val)) {
                props[p] = unescape(val);
              }
            });
          }
          const child = Object.keys(props).length !== 0 ? mergeProps({
            props
          }, tmp) : tmp;
          const isElement = React.isValidElement(child);
          const isValidTranslationWithChildren = isElement && hasChildren(node, true) && !node.voidElement;
          const isEmptyTransWithHTML = emptyChildrenButNeedsHandling && isObject(child) && child.dummy && !isElement;
          const isKnownComponent = isObject(knownComponentsMap) && Object.hasOwnProperty.call(knownComponentsMap, node.name);
          if (isString(child)) {
            const value = i18n.services.interpolator.interpolate(child, opts, i18n.language);
            mem.push(value);
          } else if (hasChildren(child) || isValidTranslationWithChildren) {
            const inner = renderInner(child, node, rootReactNode);
            pushTranslatedJSX(child, inner, mem, i);
          } else if (isEmptyTransWithHTML) {
            const inner = mapAST(reactNodes, node.children, rootReactNode);
            pushTranslatedJSX(child, inner, mem, i);
          } else if (Number.isNaN(parseFloat(node.name))) {
            if (isKnownComponent) {
              const inner = renderInner(child, node, rootReactNode);
              pushTranslatedJSX(child, inner, mem, i, node.voidElement);
            } else if (i18nOptions.transSupportBasicHtmlNodes && keepArray.indexOf(node.name) > -1) {
              if (node.voidElement) {
                mem.push(React.createElement(node.name, {
                  key: `${node.name}-${i}`
                }));
              } else {
                const occurrence = keepTagOccurrence[node.name] || 0;
                keepTagOccurrence[node.name] = occurrence + 1;
                let matched;
                let seen = 0;
                for (let r = 0; r < reactNodes.length; r += 1) {
                  const rn = reactNodes[r];
                  if (React.isValidElement(rn) && rn.type === node.name) {
                    if (seen === occurrence) {
                      matched = rn;
                      break;
                    }
                    seen += 1;
                  }
                }
                const innerScope = matched ? getAsArray(getChildren(matched)) : reactNodes;
                const inner = mapAST(innerScope, node.children, rootReactNode);
                mem.push(React.createElement(node.name, {
                  key: `${node.name}-${i}`
                }, inner));
              }
            } else if (node.voidElement) {
              mem.push(`<${node.name} />`);
            } else {
              const inner = mapAST(reactNodes, node.children, rootReactNode);
              mem.push(`<${node.name}>${inner}</${node.name}>`);
            }
          } else if (isObject(child) && !isElement) {
            const content = node.children[0] ? translationContent : null;
            if (content) mem.push(content);
          } else {
            pushTranslatedJSX(child, translationContent, mem, i, node.children.length !== 1 || !translationContent);
          }
        } else if (node.type === 'text') {
          const wrapTextNodes = i18nOptions.transWrapTextNodes;
          const unescapeFn = typeof i18nOptions.unescape === 'function' ? i18nOptions.unescape : getDefaults().unescape;
          const content = shouldUnescape ? unescapeFn(i18n.services.interpolator.interpolate(node.content, opts, i18n.language)) : i18n.services.interpolator.interpolate(node.content, opts, i18n.language);
          if (wrapTextNodes) {
            mem.push(React.createElement(wrapTextNodes, {
              key: `${node.name}-${i}`
            }, content));
          } else {
            mem.push(content);
          }
        }
        return mem;
      }, []);
    };
    const result = mapAST([{
      dummy: true,
      children: children || []
    }], ast, getAsArray(children || []));
    return getChildren(result[0]);
  };
  const fixComponentProps = (component, index, translation) => {
    const componentKey = component.key || index;
    const comp = React.cloneElement(component, {
      key: componentKey
    });
    if (!comp.props || !comp.props.children || translation.indexOf(`${index}/>`) < 0 && translation.indexOf(`${index} />`) < 0) {
      return comp;
    }
    function Componentized() {
      return React.createElement(React.Fragment, null, comp);
    }
    return React.createElement(Componentized, {
      key: componentKey
    });
  };
  const generateArrayComponents = (components, translation) => components.map((c, index) => fixComponentProps(c, index, translation));
  const generateObjectComponents = (components, translation) => {
    const componentMap = {};
    Object.keys(components).forEach(c => {
      Object.assign(componentMap, {
        [c]: fixComponentProps(components[c], c, translation)
      });
    });
    return componentMap;
  };
  const generateComponents = (components, translation, i18n, i18nKey) => {
    if (!components) return null;
    if (Array.isArray(components)) {
      return generateArrayComponents(components, translation);
    }
    if (isObject(components)) {
      return generateObjectComponents(components, translation);
    }
    warnOnce(i18n, 'TRANS_INVALID_COMPONENTS', `<Trans /> "components" prop expects an object or array`, {
      i18nKey
    });
    return null;
  };
  const isComponentsMap = object => {
    if (!isObject(object)) return false;
    if (Array.isArray(object)) return false;
    return Object.keys(object).reduce((acc, key) => acc && Number.isNaN(Number.parseFloat(key)), true);
  };
  function Trans$1({
    children,
    count,
    parent,
    i18nKey,
    context,
    tOptions = {},
    values,
    defaults,
    components,
    ns,
    i18n: i18nFromProps,
    t: tFromProps,
    shouldUnescape,
    ...additionalProps
  }) {
    const i18n = i18nFromProps || getI18n();
    if (!i18n) {
      warnOnce(i18n, 'NO_I18NEXT_INSTANCE', `Trans: You need to pass in an i18next instance using i18nextReactModule`, {
        i18nKey
      });
      return children;
    }
    const t = tFromProps || i18n.t.bind(i18n) || (k => k);
    const reactI18nextOptions = {
      ...getDefaults(),
      ...i18n.options?.react
    };
    let namespaces = ns || t.ns || i18n.options?.defaultNS;
    namespaces = isString(namespaces) ? [namespaces] : namespaces || ['translation'];
    const {
      transDefaultProps
    } = reactI18nextOptions;
    const mergedTOptions = transDefaultProps?.tOptions ? {
      ...transDefaultProps.tOptions,
      ...tOptions
    } : tOptions;
    const mergedShouldUnescape = shouldUnescape ?? transDefaultProps?.shouldUnescape;
    const mergedValues = transDefaultProps?.values ? {
      ...transDefaultProps.values,
      ...values
    } : values;
    const mergedComponents = transDefaultProps?.components ? {
      ...transDefaultProps.components,
      ...components
    } : components;
    const nodeAsString = nodesToString(children, reactI18nextOptions, i18n, i18nKey);
    const defaultValue = defaults || mergedTOptions?.defaultValue || nodeAsString || reactI18nextOptions.transEmptyNodeValue || (typeof i18nKey === 'function' ? keysFromSelector(i18nKey) : i18nKey);
    const {
      hashTransKey
    } = reactI18nextOptions;
    const key = i18nKey || (hashTransKey ? hashTransKey(nodeAsString || defaultValue) : nodeAsString || defaultValue);
    if (i18n.options?.interpolation?.defaultVariables) {
      values = mergedValues && Object.keys(mergedValues).length > 0 ? {
        ...mergedValues,
        ...i18n.options.interpolation.defaultVariables
      } : {
        ...i18n.options.interpolation.defaultVariables
      };
    } else {
      values = mergedValues;
    }
    const valuesFromChildren = getValuesFromChildren(children);
    if (valuesFromChildren && typeof valuesFromChildren.count === 'number' && count === undefined) {
      count = valuesFromChildren.count;
    }
    const interpolationOverride = values || count !== undefined && !i18n.options?.interpolation?.alwaysFormat || !children ? mergedTOptions.interpolation : {
      interpolation: {
        ...mergedTOptions.interpolation,
        prefix: '#$?',
        suffix: '?$#'
      }
    };
    const combinedTOpts = {
      ...mergedTOptions,
      context: context || mergedTOptions.context,
      count,
      ...values,
      ...interpolationOverride,
      defaultValue,
      ns: namespaces
    };
    let translation = key ? t(key, combinedTOpts) : defaultValue;
    if (translation === key && defaultValue) translation = defaultValue;
    const generatedComponents = generateComponents(mergedComponents, translation, i18n, i18nKey);
    let indexedChildren = generatedComponents || children;
    let componentsMap = null;
    if (isComponentsMap(generatedComponents)) {
      componentsMap = generatedComponents;
      indexedChildren = children;
    }
    const content = renderNodes(indexedChildren, componentsMap, translation, i18n, reactI18nextOptions, combinedTOpts, mergedShouldUnescape);
    const useAsParent = parent ?? reactI18nextOptions.defaultTransParent;
    return useAsParent ? React.createElement(useAsParent, additionalProps, content) : content;
  }

  const initReactI18next = {
    type: '3rdParty',
    init(instance) {
      setDefaults(instance.options.react);
      setI18n(instance);
    }
  };

  const I18nContext = React.createContext();
  class ReportNamespaces {
    constructor() {
      this.usedNamespaces = {};
    }
    addUsedNamespaces(namespaces) {
      namespaces.forEach(ns => {
        if (!this.usedNamespaces[ns]) this.usedNamespaces[ns] = true;
      });
    }
    getUsedNamespaces() {
      return Object.keys(this.usedNamespaces);
    }
  }
  const composeInitialProps = ForComponent => async ctx => {
    const componentsInitialProps = (await ForComponent.getInitialProps?.(ctx)) ?? {};
    const i18nInitialProps = getInitialProps();
    return {
      ...componentsInitialProps,
      ...i18nInitialProps
    };
  };
  const getInitialProps = () => {
    const i18n = getI18n();
    if (!i18n) {
      console.warn('react-i18next:: getInitialProps: You will need to pass in an i18next instance by using initReactI18next');
      return {};
    }
    const namespaces = i18n.reportNamespaces?.getUsedNamespaces() ?? [];
    const ret = {};
    const initialI18nStore = {};
    i18n.languages.forEach(l => {
      initialI18nStore[l] = {};
      namespaces.forEach(ns => {
        initialI18nStore[l][ns] = i18n.getResourceBundle(l, ns) || {};
      });
    });
    ret.initialI18nStore = initialI18nStore;
    ret.initialLanguage = i18n.language;
    return ret;
  };

  function Trans({
    children,
    count,
    parent,
    i18nKey,
    context,
    tOptions = {},
    values,
    defaults,
    components,
    ns,
    i18n: i18nFromProps,
    t: tFromProps,
    shouldUnescape,
    ...additionalProps
  }) {
    const {
      i18n: i18nFromContext,
      defaultNS: defaultNSFromContext
    } = React.useContext(I18nContext) || {};
    const i18n = i18nFromProps || i18nFromContext || getI18n();
    const t = tFromProps || i18n?.t.bind(i18n);
    return Trans$1({
      children,
      count,
      parent,
      i18nKey,
      context,
      tOptions,
      values,
      defaults,
      components,
      ns: ns || t?.ns || defaultNSFromContext || i18n?.options?.defaultNS,
      i18n,
      t: tFromProps,
      shouldUnescape,
      ...additionalProps
    });
  }

  class TranslationParserError extends Error {
    constructor(message, position, translationString) {
      super(message);
      this.name = 'TranslationParserError';
      this.position = position;
      this.translationString = translationString;
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, TranslationParserError);
      }
    }
  }

  const commonEntities = {
    '&nbsp;': '\u00A0',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&hellip;': '…',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&sbquo;': '\u201A',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&bdquo;': '\u201E',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&bull;': '•',
    '&prime;': '′',
    '&Prime;': '″',
    '&lsaquo;': '‹',
    '&rsaquo;': '›',
    '&sect;': '§',
    '&para;': '¶',
    '&middot;': '·',
    '&ensp;': '\u2002',
    '&emsp;': '\u2003',
    '&thinsp;': '\u2009',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
    '&curren;': '¤',
    '&times;': '×',
    '&divide;': '÷',
    '&minus;': '−',
    '&plusmn;': '±',
    '&ne;': '≠',
    '&le;': '≤',
    '&ge;': '≥',
    '&asymp;': '≈',
    '&equiv;': '≡',
    '&infin;': '∞',
    '&int;': '∫',
    '&sum;': '∑',
    '&prod;': '∏',
    '&radic;': '√',
    '&part;': '∂',
    '&permil;': '‰',
    '&deg;': '°',
    '&micro;': 'µ',
    '&larr;': '←',
    '&uarr;': '↑',
    '&rarr;': '→',
    '&darr;': '↓',
    '&harr;': '↔',
    '&crarr;': '↵',
    '&lArr;': '⇐',
    '&uArr;': '⇑',
    '&rArr;': '⇒',
    '&dArr;': '⇓',
    '&hArr;': '⇔',
    '&alpha;': 'α',
    '&beta;': 'β',
    '&gamma;': 'γ',
    '&delta;': 'δ',
    '&epsilon;': 'ε',
    '&zeta;': 'ζ',
    '&eta;': 'η',
    '&theta;': 'θ',
    '&iota;': 'ι',
    '&kappa;': 'κ',
    '&lambda;': 'λ',
    '&mu;': 'μ',
    '&nu;': 'ν',
    '&xi;': 'ξ',
    '&omicron;': 'ο',
    '&pi;': 'π',
    '&rho;': 'ρ',
    '&sigma;': 'σ',
    '&tau;': 'τ',
    '&upsilon;': 'υ',
    '&phi;': 'φ',
    '&chi;': 'χ',
    '&psi;': 'ψ',
    '&omega;': 'ω',
    '&Alpha;': 'Α',
    '&Beta;': 'Β',
    '&Gamma;': 'Γ',
    '&Delta;': 'Δ',
    '&Epsilon;': 'Ε',
    '&Zeta;': 'Ζ',
    '&Eta;': 'Η',
    '&Theta;': 'Θ',
    '&Iota;': 'Ι',
    '&Kappa;': 'Κ',
    '&Lambda;': 'Λ',
    '&Mu;': 'Μ',
    '&Nu;': 'Ν',
    '&Xi;': 'Ξ',
    '&Omicron;': 'Ο',
    '&Pi;': 'Π',
    '&Rho;': 'Ρ',
    '&Sigma;': 'Σ',
    '&Tau;': 'Τ',
    '&Upsilon;': 'Υ',
    '&Phi;': 'Φ',
    '&Chi;': 'Χ',
    '&Psi;': 'Ψ',
    '&Omega;': 'Ω',
    '&Agrave;': 'À',
    '&Aacute;': 'Á',
    '&Acirc;': 'Â',
    '&Atilde;': 'Ã',
    '&Auml;': 'Ä',
    '&Aring;': 'Å',
    '&AElig;': 'Æ',
    '&Ccedil;': 'Ç',
    '&Egrave;': 'È',
    '&Eacute;': 'É',
    '&Ecirc;': 'Ê',
    '&Euml;': 'Ë',
    '&Igrave;': 'Ì',
    '&Iacute;': 'Í',
    '&Icirc;': 'Î',
    '&Iuml;': 'Ï',
    '&ETH;': 'Ð',
    '&Ntilde;': 'Ñ',
    '&Ograve;': 'Ò',
    '&Oacute;': 'Ó',
    '&Ocirc;': 'Ô',
    '&Otilde;': 'Õ',
    '&Ouml;': 'Ö',
    '&Oslash;': 'Ø',
    '&Ugrave;': 'Ù',
    '&Uacute;': 'Ú',
    '&Ucirc;': 'Û',
    '&Uuml;': 'Ü',
    '&Yacute;': 'Ý',
    '&THORN;': 'Þ',
    '&szlig;': 'ß',
    '&agrave;': 'à',
    '&aacute;': 'á',
    '&acirc;': 'â',
    '&atilde;': 'ã',
    '&auml;': 'ä',
    '&aring;': 'å',
    '&aelig;': 'æ',
    '&ccedil;': 'ç',
    '&egrave;': 'è',
    '&eacute;': 'é',
    '&ecirc;': 'ê',
    '&euml;': 'ë',
    '&igrave;': 'ì',
    '&iacute;': 'í',
    '&icirc;': 'î',
    '&iuml;': 'ï',
    '&eth;': 'ð',
    '&ntilde;': 'ñ',
    '&ograve;': 'ò',
    '&oacute;': 'ó',
    '&ocirc;': 'ô',
    '&otilde;': 'õ',
    '&ouml;': 'ö',
    '&oslash;': 'ø',
    '&ugrave;': 'ù',
    '&uacute;': 'ú',
    '&ucirc;': 'û',
    '&uuml;': 'ü',
    '&yacute;': 'ý',
    '&thorn;': 'þ',
    '&yuml;': 'ÿ',
    '&iexcl;': '¡',
    '&iquest;': '¿',
    '&fnof;': 'ƒ',
    '&circ;': 'ˆ',
    '&tilde;': '˜',
    '&OElig;': 'Œ',
    '&oelig;': 'œ',
    '&Scaron;': 'Š',
    '&scaron;': 'š',
    '&Yuml;': 'Ÿ',
    '&ordf;': 'ª',
    '&ordm;': 'º',
    '&macr;': '¯',
    '&acute;': '´',
    '&cedil;': '¸',
    '&sup1;': '¹',
    '&sup2;': '²',
    '&sup3;': '³',
    '&frac14;': '¼',
    '&frac12;': '½',
    '&frac34;': '¾',
    '&spades;': '♠',
    '&clubs;': '♣',
    '&hearts;': '♥',
    '&diams;': '♦',
    '&loz;': '◊',
    '&oline;': '‾',
    '&frasl;': '⁄',
    '&weierp;': '℘',
    '&image;': 'ℑ',
    '&real;': 'ℜ',
    '&alefsym;': 'ℵ'
  };
  const entityPattern = new RegExp(Object.keys(commonEntities).map(entity => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const decodeHtmlEntities = text => text.replace(entityPattern, match => commonEntities[match]).replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10))).replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const tokenize = translation => {
    const tokens = [];
    let position = 0;
    let currentText = '';
    const flushText = () => {
      if (currentText) {
        tokens.push({
          type: 'Text',
          value: currentText,
          position: position - currentText.length
        });
        currentText = '';
      }
    };
    while (position < translation.length) {
      const char = translation[position];
      if (char === '<') {
        const tagMatch = translation.slice(position).match(/^<(\d+)>/);
        if (tagMatch) {
          flushText();
          tokens.push({
            type: 'TagOpen',
            value: tagMatch[0],
            position,
            tagNumber: parseInt(tagMatch[1], 10)
          });
          position += tagMatch[0].length;
        } else {
          const closeTagMatch = translation.slice(position).match(/^<\/(\d+)>/);
          if (closeTagMatch) {
            flushText();
            tokens.push({
              type: 'TagClose',
              value: closeTagMatch[0],
              position,
              tagNumber: parseInt(closeTagMatch[1], 10)
            });
            position += closeTagMatch[0].length;
          } else {
            currentText += char;
            position += 1;
          }
        }
      } else {
        currentText += char;
        position += 1;
      }
    }
    flushText();
    return tokens;
  };

  const renderDeclarationNode = (declaration, children, childDeclarations) => {
    const {
      type,
      props = {}
    } = declaration;
    if (props.children && Array.isArray(props.children) && childDeclarations) {
      const {
        children: _childrenToRemove,
        ...propsWithoutChildren
      } = props;
      return React.createElement(type, propsWithoutChildren, ...children);
    }
    if (children.length === 0) {
      return React.createElement(type, props);
    }
    if (children.length === 1) {
      return React.createElement(type, props, children[0]);
    }
    return React.createElement(type, props, ...children);
  };
  const renderTranslation = (translation, declarations = []) => {
    if (!translation) {
      return [];
    }
    const tokens = tokenize(translation);
    const result = [];
    const stack = [];
    const literalTagNumbers = new Set();
    const getCurrentDeclarations = () => {
      if (stack.length === 0) {
        return declarations;
      }
      const parentFrame = stack[stack.length - 1];
      if (parentFrame.declaration.props?.children && Array.isArray(parentFrame.declaration.props.children)) {
        return parentFrame.declaration.props.children;
      }
      return parentFrame.declarations;
    };
    tokens.forEach(token => {
      switch (token.type) {
        case 'Text':
          {
            const decoded = decodeHtmlEntities(token.value);
            const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;
            targetArray.push(decoded);
          }
          break;
        case 'TagOpen':
          {
            const {
              tagNumber
            } = token;
            const currentDeclarations = getCurrentDeclarations();
            const declaration = currentDeclarations[tagNumber];
            if (!declaration) {
              literalTagNumbers.add(tagNumber);
              const literalText = `<${tagNumber}>`;
              const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;
              targetArray.push(literalText);
              break;
            }
            stack.push({
              tagNumber,
              children: [],
              position: token.position,
              declaration,
              declarations: currentDeclarations
            });
          }
          break;
        case 'TagClose':
          {
            const {
              tagNumber
            } = token;
            if (literalTagNumbers.has(tagNumber)) {
              const literalText = `</${tagNumber}>`;
              const literalTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;
              literalTargetArray.push(literalText);
              literalTagNumbers.delete(tagNumber);
              break;
            }
            if (stack.length === 0) {
              throw new TranslationParserError(`Unexpected closing tag </${tagNumber}> at position ${token.position}`, token.position, translation);
            }
            const frame = stack.pop();
            if (frame.tagNumber !== tagNumber) {
              throw new TranslationParserError(`Mismatched tags: expected </${frame.tagNumber}> but got </${tagNumber}> at position ${token.position}`, token.position, translation);
            }
            const element = renderDeclarationNode(frame.declaration, frame.children, frame.declarations);
            const elementTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;
            elementTargetArray.push(element);
          }
          break;
      }
    });
    if (stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      throw new TranslationParserError(`Unclosed tag <${unclosed.tagNumber}> at position ${unclosed.position}`, unclosed.position, translation);
    }
    return result;
  };

  function IcuTransWithoutContext({
    i18nKey,
    defaultTranslation,
    content,
    ns,
    values = {},
    i18n: i18nFromProps,
    t: tFromProps
  }) {
    const i18n = i18nFromProps || getI18n();
    if (!i18n) {
      warnOnce(i18n, 'NO_I18NEXT_INSTANCE', `IcuTrans: You need to pass in an i18next instance using i18nextReactModule`, {
        i18nKey
      });
      return React.createElement(React.Fragment, {}, defaultTranslation);
    }
    const t = tFromProps || i18n.t?.bind(i18n) || (k => k);
    let namespaces = ns || t.ns || i18n.options?.defaultNS;
    namespaces = isString(namespaces) ? [namespaces] : namespaces || ['translation'];
    let mergedValues = values;
    if (i18n.options?.interpolation?.defaultVariables) {
      mergedValues = values && Object.keys(values).length > 0 ? {
        ...values,
        ...i18n.options.interpolation.defaultVariables
      } : {
        ...i18n.options.interpolation.defaultVariables
      };
    }
    const translation = t(i18nKey, {
      defaultValue: defaultTranslation,
      ...mergedValues,
      ns: namespaces
    });
    try {
      const rendered = renderTranslation(translation, content);
      return React.createElement(React.Fragment, {}, ...rendered);
    } catch (error) {
      warn(i18n, 'ICU_TRANS_RENDER_ERROR', `IcuTrans component error for key "${i18nKey}": ${error.message}`, {
        i18nKey,
        error
      });
      return React.createElement(React.Fragment, {}, translation);
    }
  }
  IcuTransWithoutContext.displayName = 'IcuTransWithoutContext';

  function IcuTrans({
    i18nKey,
    defaultTranslation,
    content,
    ns,
    values = {},
    i18n: i18nFromProps,
    t: tFromProps
  }) {
    const {
      i18n: i18nFromContext,
      defaultNS: defaultNSFromContext
    } = React.useContext(I18nContext) || {};
    const i18n = i18nFromProps || i18nFromContext || getI18n();
    const t = tFromProps || i18n?.t.bind(i18n);
    return IcuTransWithoutContext({
      i18nKey,
      defaultTranslation,
      content,
      ns: ns || t?.ns || defaultNSFromContext || i18n?.options?.defaultNS,
      values,
      i18n,
      t: tFromProps
    });
  }
  IcuTrans.displayName = 'IcuTrans';

  var shim = {exports: {}};

  var useSyncExternalStoreShim_development = {};

  /**
   * @license React
   * use-sync-external-store-shim.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   */

  var hasRequiredUseSyncExternalStoreShim_development;

  function requireUseSyncExternalStoreShim_development () {
  	if (hasRequiredUseSyncExternalStoreShim_development) return useSyncExternalStoreShim_development;
  	hasRequiredUseSyncExternalStoreShim_development = 1;

  	(function () {
  	  function is(x, y) {
  	    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  	  }
  	  function useSyncExternalStore$2(subscribe, getSnapshot) {
  	    didWarnOld18Alpha || void 0 === React$1.startTransition || (didWarnOld18Alpha = true, console.error("You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."));
  	    var value = getSnapshot();
  	    if (!didWarnUncachedGetSnapshot) {
  	      var cachedValue = getSnapshot();
  	      objectIs(value, cachedValue) || (console.error("The result of getSnapshot should be cached to avoid an infinite loop"), didWarnUncachedGetSnapshot = true);
  	    }
  	    cachedValue = useState({
  	      inst: {
  	        value: value,
  	        getSnapshot: getSnapshot
  	      }
  	    });
  	    var inst = cachedValue[0].inst,
  	      forceUpdate = cachedValue[1];
  	    useLayoutEffect(function () {
  	      inst.value = value;
  	      inst.getSnapshot = getSnapshot;
  	      checkIfSnapshotChanged(inst) && forceUpdate({
  	        inst: inst
  	      });
  	    }, [subscribe, value, getSnapshot]);
  	    useEffect(function () {
  	      checkIfSnapshotChanged(inst) && forceUpdate({
  	        inst: inst
  	      });
  	      return subscribe(function () {
  	        checkIfSnapshotChanged(inst) && forceUpdate({
  	          inst: inst
  	        });
  	      });
  	    }, [subscribe]);
  	    useDebugValue(value);
  	    return value;
  	  }
  	  function checkIfSnapshotChanged(inst) {
  	    var latestGetSnapshot = inst.getSnapshot;
  	    inst = inst.value;
  	    try {
  	      var nextValue = latestGetSnapshot();
  	      return !objectIs(inst, nextValue);
  	    } catch (error) {
  	      return true;
  	    }
  	  }
  	  function useSyncExternalStore$1(subscribe, getSnapshot) {
  	    return getSnapshot();
  	  }
  	  "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
  	  var React$1 = React,
  	    objectIs = "function" === typeof Object.is ? Object.is : is,
  	    useState = React$1.useState,
  	    useEffect = React$1.useEffect,
  	    useLayoutEffect = React$1.useLayoutEffect,
  	    useDebugValue = React$1.useDebugValue,
  	    didWarnOld18Alpha = false,
  	    didWarnUncachedGetSnapshot = false,
  	    shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
  	  useSyncExternalStoreShim_development.useSyncExternalStore = void 0 !== React$1.useSyncExternalStore ? React$1.useSyncExternalStore : shim;
  	  "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  	})();
  	return useSyncExternalStoreShim_development;
  }

  var hasRequiredShim;

  function requireShim () {
  	if (hasRequiredShim) return shim.exports;
  	hasRequiredShim = 1;

  	{
  	  shim.exports = requireUseSyncExternalStoreShim_development();
  	}
  	return shim.exports;
  }

  var shimExports = requireShim();

  const notReadyT = (k, optsOrDefaultValue) => {
    if (isString(optsOrDefaultValue)) return optsOrDefaultValue;
    if (isObject(optsOrDefaultValue) && isString(optsOrDefaultValue.defaultValue)) return optsOrDefaultValue.defaultValue;
    if (typeof k === 'function') return '';
    if (Array.isArray(k)) {
      const last = k[k.length - 1];
      return typeof last === 'function' ? '' : last;
    }
    return k;
  };
  const notReadySnapshot = {
    t: notReadyT,
    ready: false
  };
  const dummySubscribe = () => () => {};
  const useTranslation = (ns, props = {}) => {
    const {
      i18n: i18nFromProps
    } = props;
    const {
      i18n: i18nFromContext,
      defaultNS: defaultNSFromContext
    } = React.useContext(I18nContext) || {};
    const i18n = i18nFromProps || i18nFromContext || getI18n();
    if (i18n && !i18n.reportNamespaces) i18n.reportNamespaces = new ReportNamespaces();
    if (!i18n) {
      warnOnce(i18n, 'NO_I18NEXT_INSTANCE', 'useTranslation: You will need to pass in an i18next instance by using initReactI18next');
    }
    const i18nOptions = React.useMemo(() => ({
      ...getDefaults(),
      ...i18n?.options?.react,
      ...props
    }), [i18n, props]);
    const {
      useSuspense,
      keyPrefix
    } = i18nOptions;
    const nsOrContext = ns || defaultNSFromContext || i18n?.options?.defaultNS;
    const unstableNamespaces = isString(nsOrContext) ? [nsOrContext] : nsOrContext || ['translation'];
    const namespaces = React.useMemo(() => unstableNamespaces, unstableNamespaces);
    i18n?.reportNamespaces?.addUsedNamespaces?.(namespaces);
    const revisionRef = React.useRef(0);
    const subscribe = React.useCallback(callback => {
      if (!i18n) return dummySubscribe;
      const {
        bindI18n,
        bindI18nStore
      } = i18nOptions;
      const wrappedCallback = () => {
        revisionRef.current += 1;
        callback();
      };
      if (bindI18n) i18n.on(bindI18n, wrappedCallback);
      if (bindI18nStore) i18n.store.on(bindI18nStore, wrappedCallback);
      return () => {
        if (bindI18n) bindI18n.split(' ').forEach(e => i18n.off(e, wrappedCallback));
        if (bindI18nStore) bindI18nStore.split(' ').forEach(e => i18n.store.off(e, wrappedCallback));
      };
    }, [i18n, i18nOptions]);
    const snapshotRef = React.useRef();
    const getSnapshot = React.useCallback(() => {
      if (!i18n) {
        return notReadySnapshot;
      }
      const calculatedReady = !!(i18n.isInitialized || i18n.initializedStoreOnce) && namespaces.every(n => hasLoadedNamespace(n, i18n, i18nOptions));
      const currentLng = props.lng || i18n.language;
      const currentRevision = revisionRef.current;
      const lastSnapshot = snapshotRef.current;
      if (lastSnapshot && lastSnapshot.ready === calculatedReady && lastSnapshot.lng === currentLng && lastSnapshot.keyPrefix === keyPrefix && lastSnapshot.revision === currentRevision) {
        return lastSnapshot;
      }
      const calculatedT = i18n.getFixedT(currentLng, i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0], keyPrefix, {
        scopeNs: namespaces
      });
      const newSnapshot = {
        t: calculatedT,
        ready: calculatedReady,
        lng: currentLng,
        keyPrefix,
        revision: currentRevision
      };
      snapshotRef.current = newSnapshot;
      return newSnapshot;
    }, [i18n, namespaces, keyPrefix, i18nOptions, props.lng]);
    const [loadCount, setLoadCount] = React.useState(0);
    const {
      t,
      ready
    } = shimExports.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    React.useEffect(() => {
      if (i18n && !ready && !useSuspense) {
        const onLoaded = () => setLoadCount(c => c + 1);
        if (props.lng) {
          loadLanguages(i18n, props.lng, namespaces, onLoaded);
        } else {
          loadNamespaces(i18n, namespaces, onLoaded);
        }
      }
    }, [i18n, props.lng, namespaces, ready, useSuspense, loadCount]);
    const finalI18n = i18n || {};
    const wrapperRef = React.useRef(null);
    const wrapperLangRef = React.useRef();
    const createI18nWrapper = original => {
      const descriptors = Object.getOwnPropertyDescriptors(original);
      if (descriptors.__original) delete descriptors.__original;
      const wrapper = Object.create(Object.getPrototypeOf(original), descriptors);
      if (!Object.prototype.hasOwnProperty.call(wrapper, '__original')) {
        try {
          Object.defineProperty(wrapper, '__original', {
            value: original,
            writable: false,
            enumerable: false,
            configurable: false
          });
        } catch (_) {}
      }
      return wrapper;
    };
    const ret = React.useMemo(() => {
      const original = finalI18n;
      const lang = original?.language;
      let i18nWrapper = original;
      if (original) {
        if (wrapperRef.current && wrapperRef.current.__original === original) {
          if (wrapperLangRef.current !== lang) {
            i18nWrapper = createI18nWrapper(original);
            wrapperRef.current = i18nWrapper;
            wrapperLangRef.current = lang;
          } else {
            i18nWrapper = wrapperRef.current;
          }
        } else {
          i18nWrapper = createI18nWrapper(original);
          wrapperRef.current = i18nWrapper;
          wrapperLangRef.current = lang;
        }
      }
      const effectiveT = !ready && !useSuspense ? (...args) => {
        warnOnce(i18n, 'USE_T_BEFORE_READY', 'useTranslation: t was called before ready. When using useSuspense: false, make sure to check the ready flag before using t.');
        return t(...args);
      } : t;
      const arr = [effectiveT, i18nWrapper, ready];
      arr.t = effectiveT;
      arr.i18n = i18nWrapper;
      arr.ready = ready;
      return arr;
    }, [t, finalI18n, ready, finalI18n.resolvedLanguage, finalI18n.language, finalI18n.languages]);
    if (i18n && useSuspense && !ready) {
      throw new Promise(resolve => {
        const onLoaded = () => resolve();
        if (props.lng) {
          loadLanguages(i18n, props.lng, namespaces, onLoaded);
        } else {
          loadNamespaces(i18n, namespaces, onLoaded);
        }
      });
    }
    return ret;
  };

  const withTranslation = (ns, options = {}) => function Extend(WrappedComponent) {
    function I18nextWithTranslation({
      forwardedRef,
      ...rest
    }) {
      const [t, i18n, ready] = useTranslation(ns, {
        ...rest,
        keyPrefix: options.keyPrefix
      });
      const passDownProps = {
        ...rest,
        t,
        i18n,
        tReady: ready
      };
      if (options.withRef && forwardedRef) {
        passDownProps.ref = forwardedRef;
      } else if (!options.withRef && forwardedRef) {
        passDownProps.forwardedRef = forwardedRef;
      }
      return React.createElement(WrappedComponent, passDownProps);
    }
    I18nextWithTranslation.displayName = `withI18nextTranslation(${getDisplayName(WrappedComponent)})`;
    I18nextWithTranslation.WrappedComponent = WrappedComponent;
    const forwardRef = (props, ref) => React.createElement(I18nextWithTranslation, Object.assign({}, props, {
      forwardedRef: ref
    }));
    return options.withRef ? React.forwardRef(forwardRef) : I18nextWithTranslation;
  };

  const Translation = ({
    ns,
    children,
    ...options
  }) => {
    const [t, i18n, ready] = useTranslation(ns, options);
    return children(t, {
      i18n,
      lng: i18n?.language
    }, ready);
  };

  function I18nextProvider({
    i18n,
    defaultNS,
    children
  }) {
    const value = React.useMemo(() => ({
      i18n,
      defaultNS
    }), [i18n, defaultNS]);
    return React.createElement(I18nContext.Provider, {
      value
    }, children);
  }

  const useSSR = (initialI18nStore, initialLanguage, props = {}) => {
    const {
      i18n: i18nFromProps
    } = props;
    const {
      i18n: i18nFromContext
    } = React.useContext(I18nContext) || {};
    const i18n = i18nFromProps || i18nFromContext || getI18n();
    if (!i18n) {
      warnOnce(i18n, 'NO_I18NEXT_INSTANCE', 'useSSR: You will need to pass in an i18next instance by using initReactI18next or by passing it via props or context. In monorepo setups, make sure there is only one instance of react-i18next.');
      return;
    }
    if (i18n.options?.isClone) return;
    if (initialI18nStore && !i18n.initializedStoreOnce) {
      if (!i18n.services?.resourceStore) {
        warnOnce(i18n, 'I18N_NOT_INITIALIZED', 'useSSR: i18n instance was found but not initialized (services.resourceStore is missing). Make sure you call i18next.init() before using useSSR — e.g. at module level, not only in getStaticProps/getServerSideProps.');
        return;
      }
      i18n.services.resourceStore.data = initialI18nStore;
      i18n.options.ns = Object.values(initialI18nStore).reduce((mem, lngResources) => {
        Object.keys(lngResources).forEach(ns => {
          if (mem.indexOf(ns) < 0) mem.push(ns);
        });
        return mem;
      }, i18n.options.ns);
      i18n.initializedStoreOnce = true;
      i18n.isInitialized = true;
    }
    if (initialLanguage && !i18n.initializedLanguageOnce) {
      i18n.changeLanguage(initialLanguage);
      i18n.initializedLanguageOnce = true;
    }
  };

  const withSSR = () => function Extend(WrappedComponent) {
    function I18nextWithSSR({
      initialI18nStore,
      initialLanguage,
      ...rest
    }) {
      useSSR(initialI18nStore, initialLanguage);
      return React.createElement(WrappedComponent, {
        ...rest
      });
    }
    I18nextWithSSR.getInitialProps = composeInitialProps(WrappedComponent);
    I18nextWithSSR.displayName = `withI18nextSSR(${getDisplayName(WrappedComponent)})`;
    I18nextWithSSR.WrappedComponent = WrappedComponent;
    return I18nextWithSSR;
  };

  const date = () => '';
  const time = () => '';
  const number = () => '';
  const select = () => '';
  const plural = () => '';
  const selectOrdinal = () => '';

  exports.I18nContext = I18nContext;
  exports.I18nextProvider = I18nextProvider;
  exports.IcuTrans = IcuTrans;
  exports.IcuTransWithoutContext = IcuTransWithoutContext;
  exports.Trans = Trans;
  exports.TransWithoutContext = Trans$1;
  exports.Translation = Translation;
  exports.composeInitialProps = composeInitialProps;
  exports.date = date;
  exports.getDefaults = getDefaults;
  exports.getI18n = getI18n;
  exports.getInitialProps = getInitialProps;
  exports.initReactI18next = initReactI18next;
  exports.nodesToString = nodesToString;
  exports.number = number;
  exports.plural = plural;
  exports.select = select;
  exports.selectOrdinal = selectOrdinal;
  exports.setDefaults = setDefaults;
  exports.setI18n = setI18n;
  exports.time = time;
  exports.useSSR = useSSR;
  exports.useTranslation = useTranslation;
  exports.withSSR = withSSR;
  exports.withTranslation = withTranslation;

}));

/*!
  * vue-router v3.6.5
  * (c) 2022 Evan You
  * @license MIT
  */
/*  */

function assert (condition, message) {
  if (!condition) {
    throw new Error(`[vue-router] ${message}`)
  }
}

function warn (condition, message) {
  if (!condition) {
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`);
  }
}

function extend (a, b) {
  for (const key in b) {
    a[key] = b[key];
  }
  return a
}

/*  */

const encodeReserveRE = /[!'()*]/g;
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16);
const commaRE = /%2C/g;

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = str =>
  encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ',');

function decode (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    {
      warn(false, `Error decoding "${str}". Leaving it intact.`);
    }
  }
  return str
}

function resolveQuery (
  query,
  extraQuery = {},
  _parseQuery
) {
  const parse = _parseQuery || parseQuery;
  let parsedQuery;
  try {
    parsedQuery = parse(query || '');
  } catch (e) {
    warn(false, e.message);
    parsedQuery = {};
  }
  for (const key in extraQuery) {
    const value = extraQuery[key];
    parsedQuery[key] = Array.isArray(value)
      ? value.map(castQueryParamValue)
      : castQueryParamValue(value);
  }
  return parsedQuery
}

const castQueryParamValue = value => (value == null || typeof value === 'object' ? value : String(value));

function parseQuery (query) {
  const res = {};

  query = query.trim().replace(/^(\?|#|&)/, '');

  if (!query) {
    return res
  }

  query.split('&').forEach(param => {
    const parts = param.replace(/\+/g, ' ').split('=');
    const key = decode(parts.shift());
    const val = parts.length > 0 ? decode(parts.join('=')) : null;

    if (res[key] === undefined) {
      res[key] = val;
    } else if (Array.isArray(res[key])) {
      res[key].push(val);
    } else {
      res[key] = [res[key], val];
    }
  });

  return res
}

function stringifyQuery (obj) {
  const res = obj
    ? Object.keys(obj)
      .map(key => {
        const val = obj[key];

        if (val === undefined) {
          return ''
        }

        if (val === null) {
          return encode(key)
        }

        if (Array.isArray(val)) {
          const result = [];
          val.forEach(val2 => {
            if (val2 === undefined) {
              return
            }
            if (val2 === null) {
              result.push(encode(key));
            } else {
              result.push(encode(key) + '=' + encode(val2));
            }
          });
          return result.join('&')
        }

        return encode(key) + '=' + encode(val)
      })
      .filter(x => x.length > 0)
      .join('&')
    : null;
  return res ? `?${res}` : ''
}

/*  */

const trailingSlashRE = /\/?$/;

function createRoute (
  record,
  location,
  redirectedFrom,
  router
) {
  const stringifyQuery = router && router.options.stringifyQuery;

  let query = location.query || {};
  try {
    query = clone(query);
  } catch (e) {}

  const route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  };
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery);
  }
  return Object.freeze(route)
}

function clone (value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {};
    for (const key in value) {
      res[key] = clone(value[key]);
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
const START = createRoute(null, {
  path: '/'
});

function formatMatch (record) {
  const res = [];
  while (record) {
    res.unshift(record);
    record = record.parent;
  }
  return res
}

function getFullPath (
  { path, query = {}, hash = '' },
  _stringifyQuery
) {
  const stringify = _stringifyQuery || stringifyQuery;
  return (path || '/') + stringify(query) + hash
}

function isSameRoute (a, b, onlyPath) {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    return a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') && (onlyPath ||
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query))
  } else if (a.name && b.name) {
    return (
      a.name === b.name &&
      (onlyPath || (
        a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params))
      )
    )
  } else {
    return false
  }
}

function isObjectEqual (a = {}, b = {}) {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every((key, i) => {
    const aVal = a[key];
    const bKey = bKeys[i];
    if (bKey !== key) return false
    const bVal = b[key];
    // query values can be null and undefined
    if (aVal == null || bVal == null) return aVal === bVal
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

function isIncludedRoute (current, target) {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current, target) {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}

function handleRouteEntered (route) {
  for (let i = 0; i < route.matched.length; i++) {
    const record = route.matched[i];
    for (const name in record.instances) {
      const instance = record.instances[name];
      const cbs = record.enteredCbs[name];
      if (!instance || !cbs) continue
      delete record.enteredCbs[name];
      for (let i = 0; i < cbs.length; i++) {
        if (!instance._isBeingDestroyed) cbs[i](instance);
      }
    }
  }
}

var View = {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true;

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    const h = parent.$createElement;
    const name = props.name;
    const route = parent.$route;
    const cache = parent._routerViewCache || (parent._routerViewCache = {});

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0;
    let inactive = false;
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {};
      if (vnodeData.routerView) {
        depth++;
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true;
      }
      parent = parent.$parent;
    }
    data.routerViewDepth = depth;

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      const cachedData = cache[name];
      const cachedComponent = cachedData && cachedData.component;
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps);
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }

    const matched = route.matched[depth];
    const component = matched && matched.components[name];

    // render empty node if no matched route or no config component
    if (!matched || !component) {
      cache[name] = null;
      return h()
    }

    // cache component
    cache[name] = { component };

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name];
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val;
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance;
    };

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance;
      }

      // if the route transition has already been confirmed then we weren't
      // able to call the cbs during confirmation as the component was not
      // registered yet, so we call it here.
      handleRouteEntered(route);
    };

    const configProps = matched.props && matched.props[name];
    // save route and configProps in cache
    if (configProps) {
      extend(cache[name], {
        route,
        configProps
      });
      fillPropsinData(component, data, route, configProps);
    }

    return h(component, data, children)
  }
};

function fillPropsinData (component, data, route, configProps) {
  // resolve props
  let propsToPass = data.props = resolveProps(route, configProps);
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass);
    // pass non-declared props as attrs
    const attrs = data.attrs = data.attrs || {};
    for (const key in propsToPass) {
      if (!component.props || !(key in component.props)) {
        attrs[key] = propsToPass[key];
        delete propsToPass[key];
      }
    }
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        );
      }
  }
}

/*  */

function resolvePath (
  relative,
  base,
  append
) {
  const firstChar = relative.charAt(0);
  if (firstChar === '/') {
    return relative
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  const stack = base.split('/');

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop();
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/');
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === '..') {
      stack.pop();
    } else if (segment !== '.') {
      stack.push(segment);
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('');
  }

  return stack.join('/')
}

function parsePath (path) {
  let hash = '';
  let query = '';

  const hashIndex = path.indexOf('#');
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex);
    path = path.slice(0, hashIndex);
  }

  const queryIndex = path.indexOf('?');
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1);
    path = path.slice(0, queryIndex);
  }

  return {
    path,
    query,
    hash
  }
}

function cleanPath (path) {
  return path.replace(/\/(?:\s*\/)+/g, '/')
}

var isarray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

/**
 * Expose `pathToRegexp`.
 */
var pathToRegexp_1 = pathToRegexp;
var parse_1 = parse;
var compile_1 = compile;
var tokensToFunction_1 = tokensToFunction;
var tokensToRegExp_1 = tokensToRegExp;

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g');

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = [];
  var key = 0;
  var index = 0;
  var path = '';
  var defaultDelimiter = options && options.delimiter || '/';
  var res;

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0];
    var escaped = res[1];
    var offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1];
      continue
    }

    var next = str[index];
    var prefix = res[2];
    var name = res[3];
    var capture = res[4];
    var group = res[5];
    var modifier = res[6];
    var asterisk = res[7];

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
    }

    var partial = prefix != null && next != null && next !== prefix;
    var repeat = modifier === '+' || modifier === '*';
    var optional = modifier === '?' || modifier === '*';
    var delimiter = res[2] || defaultDelimiter;
    var pattern = capture || group;

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      asterisk: !!asterisk,
      pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
    });
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index);
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path);
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options), options)
}

/**
 * Prettier encoding of URI path segments.
 *
 * @param  {string}
 * @return {string}
 */
function encodeURIComponentPretty (str) {
  return encodeURI(str).replace(/[\/?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
 *
 * @param  {string}
 * @return {string}
 */
function encodeAsterisk (str) {
  return encodeURI(str).replace(/[?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens, options) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length);

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$', flags(options));
    }
  }

  return function (obj, opts) {
    var path = '';
    var data = obj || {};
    var options = opts || {};
    var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        path += token;

        continue
      }

      var value = data[token.name];
      var segment;

      if (value == null) {
        if (token.optional) {
          // Prepend partial segment prefixes.
          if (token.partial) {
            path += token.prefix;
          }

          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j]);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue
      }

      segment = token.asterisk ? encodeAsterisk(value) : encode(value);

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment;
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {!RegExp} re
 * @param  {Array}   keys
 * @return {!RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys;
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options && options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {!Array}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g);

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        partial: false,
        asterisk: false,
        pattern: null
      });
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array}   keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = [];

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source);
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {!Array}  keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}          tokens
 * @param  {(Array|Object)=} keys
 * @param  {Object=}         options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options);
    keys = [];
  }

  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var route = '';

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof token === 'string') {
      route += escapeString(token);
    } else {
      var prefix = escapeString(token.prefix);
      var capture = '(?:' + token.pattern + ')';

      keys.push(token);

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*';
      }

      if (token.optional) {
        if (!token.partial) {
          capture = '(?:' + prefix + '(' + capture + '))?';
        } else {
          capture = prefix + '(' + capture + ')?';
        }
      } else {
        capture = prefix + '(' + capture + ')';
      }

      route += capture;
    }
  }

  var delimiter = escapeString(options.delimiter || '/');
  var endsWithDelimiter = route.slice(-delimiter.length) === delimiter;

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithDelimiter ? route.slice(0, -delimiter.length) : route) + '(?:' + delimiter + '(?=$))?';
  }

  if (end) {
    route += '$';
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithDelimiter ? '' : '(?=' + delimiter + '|$)';
  }

  return attachKeys(new RegExp('^' + route, flags(options)), keys)
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {(Array|Object)=}       keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options);
    keys = [];
  }

  options = options || {};

  if (path instanceof RegExp) {
    return regexpToRegexp(path, /** @type {!Array} */ (keys))
  }

  if (isarray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
  }

  return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
}
pathToRegexp_1.parse = parse_1;
pathToRegexp_1.compile = compile_1;
pathToRegexp_1.tokensToFunction = tokensToFunction_1;
pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

/*  */

// $flow-disable-line
const regexpCompileCache = Object.create(null);

function fillParams (
  path,
  params,
  routeMsg
) {
  params = params || {};
  try {
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = pathToRegexp_1.compile(path));

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // and fix #3106 so that you can work with location descriptor object having params.pathMatch equal to empty string
    if (typeof params.pathMatch === 'string') params[0] = params.pathMatch;

    return filler(params, { pretty: true })
  } catch (e) {
    {
      // Fix #3072 no warn if `pathMatch` is string
      warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`);
    }
    return ''
  } finally {
    // delete the 0 if it was added
    delete params[0];
  }
}

/*  */

function normalizeLocation (
  raw,
  current,
  append,
  router
) {
  let next = typeof raw === 'string' ? { path: raw } : raw;
  // named target
  if (next._normalized) {
    return next
  } else if (next.name) {
    next = extend({}, raw);
    const params = next.params;
    if (params && typeof params === 'object') {
      next.params = extend({}, params);
    }
    return next
  }

  // relative params
  if (!next.path && next.params && current) {
    next = extend({}, next);
    next._normalized = true;
    const params = extend(extend({}, current.params), next.params);
    if (current.name) {
      next.name = current.name;
      next.params = params;
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path;
      next.path = fillParams(rawPath, params, `path ${current.path}`);
    } else {
      warn(false, `relative params navigation requires a current route.`);
    }
    return next
  }

  const parsedPath = parsePath(next.path || '');
  const basePath = (current && current.path) || '/';
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath;

  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  );

  let hash = next.hash || parsedPath.hash;
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`;
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}

/*  */

// work around weird flow bug
const toTypes = [String, Object];
const eventTypes = [String, Array];

const noop = () => {};

let warnedCustomSlot;
let warnedTagProp;
let warnedEventProp;

var Link = {
  name: 'RouterLink',
  props: {
    to: {
      type: toTypes,
      required: true
    },
    tag: {
      type: String,
      default: 'a'
    },
    custom: Boolean,
    exact: Boolean,
    exactPath: Boolean,
    append: Boolean,
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    ariaCurrentValue: {
      type: String,
      default: 'page'
    },
    event: {
      type: eventTypes,
      default: 'click'
    }
  },
  render (h) {
    const router = this.$router;
    const current = this.$route;
    const { location, route, href } = router.resolve(
      this.to,
      current,
      this.append
    );

    const classes = {};
    const globalActiveClass = router.options.linkActiveClass;
    const globalExactActiveClass = router.options.linkExactActiveClass;
    // Support global empty active class
    const activeClassFallback =
      globalActiveClass == null ? 'router-link-active' : globalActiveClass;
    const exactActiveClassFallback =
      globalExactActiveClass == null
        ? 'router-link-exact-active'
        : globalExactActiveClass;
    const activeClass =
      this.activeClass == null ? activeClassFallback : this.activeClass;
    const exactActiveClass =
      this.exactActiveClass == null
        ? exactActiveClassFallback
        : this.exactActiveClass;

    const compareTarget = route.redirectedFrom
      ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
      : route;

    classes[exactActiveClass] = isSameRoute(current, compareTarget, this.exactPath);
    classes[activeClass] = this.exact || this.exactPath
      ? classes[exactActiveClass]
      : isIncludedRoute(current, compareTarget);

    const ariaCurrentValue = classes[exactActiveClass] ? this.ariaCurrentValue : null;

    const handler = e => {
      if (guardEvent(e)) {
        if (this.replace) {
          router.replace(location, noop);
        } else {
          router.push(location, noop);
        }
      }
    };

    const on = { click: guardEvent };
    if (Array.isArray(this.event)) {
      this.event.forEach(e => {
        on[e] = handler;
      });
    } else {
      on[this.event] = handler;
    }

    const data = { class: classes };

    const scopedSlot =
      !this.$scopedSlots.$hasNormal &&
      this.$scopedSlots.default &&
      this.$scopedSlots.default({
        href,
        route,
        navigate: handler,
        isActive: classes[activeClass],
        isExactActive: classes[exactActiveClass]
      });

    if (scopedSlot) {
      if (!this.custom) {
        !warnedCustomSlot && warn(false, 'In Vue Router 4, the v-slot API will by default wrap its content with an <a> element. Use the custom prop to remove this warning:\n<router-link v-slot="{ navigate, href }" custom></router-link>\n');
        warnedCustomSlot = true;
      }
      if (scopedSlot.length === 1) {
        return scopedSlot[0]
      } else if (scopedSlot.length > 1 || !scopedSlot.length) {
        {
          warn(
            false,
            `<router-link> with to="${
              this.to
            }" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
          );
        }
        return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
      }
    }

    {
      if ('tag' in this.$options.propsData && !warnedTagProp) {
        warn(
          false,
          `<router-link>'s tag prop is deprecated and has been removed in Vue Router 4. Use the v-slot API to remove this warning: https://next.router.vuejs.org/guide/migration/#removal-of-event-and-tag-props-in-router-link.`
        );
        warnedTagProp = true;
      }
      if ('event' in this.$options.propsData && !warnedEventProp) {
        warn(
          false,
          `<router-link>'s event prop is deprecated and has been removed in Vue Router 4. Use the v-slot API to remove this warning: https://next.router.vuejs.org/guide/migration/#removal-of-event-and-tag-props-in-router-link.`
        );
        warnedEventProp = true;
      }
    }

    if (this.tag === 'a') {
      data.on = on;
      data.attrs = { href, 'aria-current': ariaCurrentValue };
    } else {
      // find the first <a> child and apply listener and href
      const a = findAnchor(this.$slots.default);
      if (a) {
        // in case the <a> is a static node
        a.isStatic = false;
        const aData = (a.data = extend({}, a.data));
        aData.on = aData.on || {};
        // transform existing events in both objects into arrays so we can push later
        for (const event in aData.on) {
          const handler = aData.on[event];
          if (event in on) {
            aData.on[event] = Array.isArray(handler) ? handler : [handler];
          }
        }
        // append new listeners for router-link
        for (const event in on) {
          if (event in aData.on) {
            // on[event] is always a function
            aData.on[event].push(on[event]);
          } else {
            aData.on[event] = handler;
          }
        }

        const aAttrs = (a.data.attrs = extend({}, a.data.attrs));
        aAttrs.href = href;
        aAttrs['aria-current'] = ariaCurrentValue;
      } else {
        // doesn't have <a> child, apply listener to self
        data.on = on;
      }
    }

    return h(this.tag, data, this.$slots.default)
  }
};

function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // don't redirect when preventDefault called
  if (e.defaultPrevented) return
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) return
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target');
    if (/\b_blank\b/i.test(target)) return
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault();
  }
  return true
}

function findAnchor (children) {
  if (children) {
    let child;
    for (let i = 0; i < children.length; i++) {
      child = children[i];
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}

let _Vue;

function install (Vue) {
  if (install.installed && _Vue === Vue) return
  install.installed = true;

  _Vue = Vue;

  const isDef = v => v !== undefined;

  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode;
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal);
    }
  };

  Vue.mixin({
    beforeCreate () {
      if (isDef(this.$options.router)) {
        this._routerRoot = this;
        this._router = this.$options.router;
        this._router.init(this);
        Vue.util.defineReactive(this, '_route', this._router.history.current);
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
      }
      registerInstance(this, this);
    },
    destroyed () {
      registerInstance(this);
    }
  });

  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  });

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  });

  Vue.component('RouterView', View);
  Vue.component('RouterLink', Link);

  const strats = Vue.config.optionMergeStrategies;
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created;
}

/*  */

const inBrowser = typeof window !== 'undefined';

/*  */

function createRouteMap (
  routes,
  oldPathList,
  oldPathMap,
  oldNameMap,
  parentRoute
) {
  // the path list is used to control path matching priority
  const pathList = oldPathList || [];
  // $flow-disable-line
  const pathMap = oldPathMap || Object.create(null);
  // $flow-disable-line
  const nameMap = oldNameMap || Object.create(null);

  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route, parentRoute);
  });

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0]);
      l--;
      i--;
    }
  }

  {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/');

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n');
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`);
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord (
  pathList,
  pathMap,
  nameMap,
  route,
  parent,
  matchAs
) {
  const { path, name } = route;
  {
    assert(path != null, `"path" is required in a route configuration.`);
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    );

    warn(
      // eslint-disable-next-line no-control-regex
      !/[^\u0000-\u007F]+/.test(path),
      `Route with path "${path}" contains unencoded characters, make sure ` +
        `your path is correctly encoded before passing it to the router. Use ` +
        `encodeURI to encode static segments of your path.`
    );
  }

  const pathToRegexpOptions =
    route.pathToRegexpOptions || {};
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict);

  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive;
  }

  const record = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    alias: route.alias
      ? typeof route.alias === 'string'
        ? [route.alias]
        : route.alias
      : [],
    instances: {},
    enteredCbs: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props }
  };

  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'}"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        );
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined;
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
    });
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path);
    pathMap[record.path] = record;
  }

  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias];
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i];
      if (alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        );
        // skip in dev to make it work
        continue
      }

      const aliasRoute = {
        path: alias,
        children: route.children
      };
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      );
    }
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record;
    } else if (!matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      );
    }
  }
}

function compileRouteRegex (
  path,
  pathToRegexpOptions
) {
  const regex = pathToRegexp_1(path, [], pathToRegexpOptions);
  {
    const keys = Object.create(null);
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      );
      keys[key.name] = true;
    });
  }
  return regex
}

function normalizePath (
  path,
  parent,
  strict
) {
  if (!strict) path = path.replace(/\/$/, '');
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}

/*  */



function createMatcher (
  routes,
  router
) {
  const { pathList, pathMap, nameMap } = createRouteMap(routes);

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap);
  }

  function addRoute (parentOrRoute, route) {
    const parent = (typeof parentOrRoute !== 'object') ? nameMap[parentOrRoute] : undefined;
    // $flow-disable-line
    createRouteMap([route || parentOrRoute], pathList, pathMap, nameMap, parent);

    // add aliases of parent
    if (parent && parent.alias.length) {
      createRouteMap(
        // $flow-disable-line route is defined if parent is
        parent.alias.map(alias => ({ path: alias, children: [route] })),
        pathList,
        pathMap,
        nameMap,
        parent
      );
    }
  }

  function getRoutes () {
    return pathList.map(path => pathMap[path])
  }

  function match (
    raw,
    currentRoute,
    redirectedFrom
  ) {
    const location = normalizeLocation(raw, currentRoute, false, router);
    const { name } = location;

    if (name) {
      const record = nameMap[name];
      {
        warn(record, `Route with name '${name}' does not exist`);
      }
      if (!record) return _createRoute(null, location)
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name);

      if (typeof location.params !== 'object') {
        location.params = {};
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key];
          }
        }
      }

      location.path = fillParams(record.path, location.params, `named route "${name}"`);
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {};
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i];
        const record = pathMap[path];
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

  function redirect (
    record,
    location
  ) {
    const originalRedirect = record.redirect;
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect;

    if (typeof redirect === 'string') {
      redirect = { path: redirect };
    }

    if (!redirect || typeof redirect !== 'object') {
      {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        );
      }
      return _createRoute(null, location)
    }

    const re = redirect;
    const { name, path } = re;
    let { query, hash, params } = location;
    query = re.hasOwnProperty('query') ? re.query : query;
    hash = re.hasOwnProperty('hash') ? re.hash : hash;
    params = re.hasOwnProperty('params') ? re.params : params;

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name];
      {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`);
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record);
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`);
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`);
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record,
    location,
    matchAs
  ) {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`);
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    });
    if (aliasedMatch) {
      const matched = aliasedMatch.matched;
      const aliasedRecord = matched[matched.length - 1];
      location.params = aliasedMatch.params;
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  function _createRoute (
    record,
    location,
    redirectedFrom
  ) {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoute,
    getRoutes,
    addRoutes
  }
}

function matchRoute (
  regex,
  path,
  params
) {
  const m = path.match(regex);

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1];
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = typeof m[i] === 'string' ? decode(m[i]) : m[i];
    }
  }

  return true
}

function resolveRecordPath (path, record) {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}

/*  */

// use User Timing api (if present) for more accurate key precision
const Time =
  inBrowser && window.performance && window.performance.now
    ? window.performance
    : Date;

function genStateKey () {
  return Time.now().toFixed(3)
}

let _key = genStateKey();

function getStateKey () {
  return _key
}

function setStateKey (key) {
  return (_key = key)
}

/*  */

const positionStore = Object.create(null);

function setupScroll () {
  // Prevent browser scroll behavior on History popstate
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
  // window.location.protocol + '//' + window.location.host
  // location.host contains the port and location.hostname doesn't
  const protocolAndPath = window.location.protocol + '//' + window.location.host;
  const absolutePath = window.location.href.replace(protocolAndPath, '');
  // preserve existing history state as it could be overriden by the user
  const stateCopy = extend({}, window.history.state);
  stateCopy.key = getStateKey();
  window.history.replaceState(stateCopy, '', absolutePath);
  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
  }
}

function handleScroll (
  router,
  to,
  from,
  isPop
) {
  if (!router.app) {
    return
  }

  const behavior = router.options.scrollBehavior;
  if (!behavior) {
    return
  }

  {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`);
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    const position = getScrollPosition();
    const shouldScroll = behavior.call(
      router,
      to,
      from,
      isPop ? position : null
    );

    if (!shouldScroll) {
      return
    }

    if (typeof shouldScroll.then === 'function') {
      shouldScroll
        .then(shouldScroll => {
          scrollToPosition((shouldScroll), position);
        })
        .catch(err => {
          {
            assert(false, err.toString());
          }
        });
    } else {
      scrollToPosition(shouldScroll, position);
    }
  });
}

function saveScrollPosition () {
  const key = getStateKey();
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    };
  }
}

function handlePopState (e) {
  saveScrollPosition();
  if (e.state && e.state.key) {
    setStateKey(e.state.key);
  }
}

function getScrollPosition () {
  const key = getStateKey();
  if (key) {
    return positionStore[key]
  }
}

function getElementPosition (el, offset) {
  const docEl = document.documentElement;
  const docRect = docEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

function isValidPosition (obj) {
  return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition (obj) {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

function normalizeOffset (obj) {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

function isNumber (v) {
  return typeof v === 'number'
}

const hashStartsWithNumberRE = /^#\d/;

function scrollToPosition (shouldScroll, position) {
  const isObject = typeof shouldScroll === 'object';
  if (isObject && typeof shouldScroll.selector === 'string') {
    // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
    // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
    const el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
      ? document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line
      : document.querySelector(shouldScroll.selector);

    if (el) {
      let offset =
        shouldScroll.offset && typeof shouldScroll.offset === 'object'
          ? shouldScroll.offset
          : {};
      offset = normalizeOffset(offset);
      position = getElementPosition(el, offset);
    } else if (isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll);
    }
  } else if (isObject && isValidPosition(shouldScroll)) {
    position = normalizePosition(shouldScroll);
  }

  if (position) {
    // $flow-disable-line
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({
        left: position.x,
        top: position.y,
        // $flow-disable-line
        behavior: shouldScroll.behavior
      });
    } else {
      window.scrollTo(position.x, position.y);
    }
  }
}

/*  */

const supportsPushState =
  inBrowser &&
  (function () {
    const ua = window.navigator.userAgent;

    if (
      (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1 &&
      ua.indexOf('Windows Phone') === -1
    ) {
      return false
    }

    return window.history && typeof window.history.pushState === 'function'
  })();

function pushState (url, replace) {
  saveScrollPosition();
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history;
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state);
      stateCopy.key = getStateKey();
      history.replaceState(stateCopy, '', url);
    } else {
      history.pushState({ key: setStateKey(genStateKey()) }, '', url);
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url);
  }
}

function replaceState (url) {
  pushState(url, true);
}

// When changing thing, also edit router.d.ts
const NavigationFailureType = {
  redirected: 2,
  aborted: 4,
  cancelled: 8,
  duplicated: 16
};

function createNavigationRedirectedError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.redirected,
    `Redirected when going from "${from.fullPath}" to "${stringifyRoute(
      to
    )}" via a navigation guard.`
  )
}

function createNavigationDuplicatedError (from, to) {
  const error = createRouterError(
    from,
    to,
    NavigationFailureType.duplicated,
    `Avoided redundant navigation to current location: "${from.fullPath}".`
  );
  // backwards compatible with the first introduction of Errors
  error.name = 'NavigationDuplicated';
  return error
}

function createNavigationCancelledError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.cancelled,
    `Navigation cancelled from "${from.fullPath}" to "${
      to.fullPath
    }" with a new navigation.`
  )
}

function createNavigationAbortedError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.aborted,
    `Navigation aborted from "${from.fullPath}" to "${
      to.fullPath
    }" via a navigation guard.`
  )
}

function createRouterError (from, to, type, message) {
  const error = new Error(message);
  error._isRouter = true;
  error.from = from;
  error.to = to;
  error.type = type;

  return error
}

const propertiesToLog = ['params', 'query', 'hash'];

function stringifyRoute (to) {
  if (typeof to === 'string') return to
  if ('path' in to) return to.path
  const location = {};
  propertiesToLog.forEach(key => {
    if (key in to) location[key] = to[key];
  });
  return JSON.stringify(location, null, 2)
}

function isError (err) {
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}

function isNavigationFailure (err, errorType) {
  return (
    isError(err) &&
    err._isRouter &&
    (errorType == null || err.type === errorType)
  )
}

/*  */

function runQueue (queue, fn, cb) {
  const step = index => {
    if (index >= queue.length) {
      cb();
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1);
        });
      } else {
        step(index + 1);
      }
    }
  };
  step(0);
}

/*  */

function resolveAsyncComponents (matched) {
  return (to, from, next) => {
    let hasAsync = false;
    let pending = 0;
    let error = null;

    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true;
        pending++;

        const resolve = once(resolvedDef => {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default;
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef);
          match.components[key] = resolvedDef;
          pending--;
          if (pending <= 0) {
            next();
          }
        });

        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`;
          warn(false, msg);
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg);
            next(error);
          }
        });

        let res;
        try {
          res = def(resolve, reject);
        } catch (e) {
          reject(e);
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject);
          } else {
            // new syntax in Vue 2.3
            const comp = res.component;
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject);
            }
          }
        }
      }
    });

    if (!hasAsync) next();
  }
}

function flatMapComponents (
  matched,
  fn
) {
  return flatten(matched.map(m => {
    return Object.keys(m.components).map(key => fn(
      m.components[key],
      m.instances[key],
      m, key
    ))
  }))
}

function flatten (arr) {
  return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol';

function isESModule (obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once (fn) {
  let called = false;
  return function (...args) {
    if (called) return
    called = true;
    return fn.apply(this, args)
  }
}

/*  */

class History {
  
  
  
  
  
  
  
  
  
  
  

  // implemented by sub-classes
  
  
  
  
  
  

  constructor (router, base) {
    this.router = router;
    this.base = normalizeBase(base);
    // start with a route object that stands for "nowhere"
    this.current = START;
    this.pending = null;
    this.ready = false;
    this.readyCbs = [];
    this.readyErrorCbs = [];
    this.errorCbs = [];
    this.listeners = [];
  }

  listen (cb) {
    this.cb = cb;
  }

  onReady (cb, errorCb) {
    if (this.ready) {
      cb();
    } else {
      this.readyCbs.push(cb);
      if (errorCb) {
        this.readyErrorCbs.push(errorCb);
      }
    }
  }

  onError (errorCb) {
    this.errorCbs.push(errorCb);
  }

  transitionTo (
    location,
    onComplete,
    onAbort
  ) {
    let route;
    // catch redirect option https://github.com/vuejs/vue-router/issues/3201
    try {
      route = this.router.match(location, this.current);
    } catch (e) {
      this.errorCbs.forEach(cb => {
        cb(e);
      });
      // Exception should still be thrown
      throw e
    }
    const prev = this.current;
    this.confirmTransition(
      route,
      () => {
        this.updateRoute(route);
        onComplete && onComplete(route);
        this.ensureURL();
        this.router.afterHooks.forEach(hook => {
          hook && hook(route, prev);
        });

        // fire ready cbs once
        if (!this.ready) {
          this.ready = true;
          this.readyCbs.forEach(cb => {
            cb(route);
          });
        }
      },
      err => {
        if (onAbort) {
          onAbort(err);
        }
        if (err && !this.ready) {
          // Initial redirection should not mark the history as ready yet
          // because it's triggered by the redirection instead
          // https://github.com/vuejs/vue-router/issues/3225
          // https://github.com/vuejs/vue-router/issues/3331
          if (!isNavigationFailure(err, NavigationFailureType.redirected) || prev !== START) {
            this.ready = true;
            this.readyErrorCbs.forEach(cb => {
              cb(err);
            });
          }
        }
      }
    );
  }

  confirmTransition (route, onComplete, onAbort) {
    const current = this.current;
    this.pending = route;
    const abort = err => {
      // changed after adding errors with
      // https://github.com/vuejs/vue-router/pull/3047 before that change,
      // redirect and aborted navigation would produce an err == null
      if (!isNavigationFailure(err) && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err);
          });
        } else {
          {
            warn(false, 'uncaught error during route navigation:');
          }
          console.error(err);
        }
      }
      onAbort && onAbort(err);
    };
    const lastRouteIndex = route.matched.length - 1;
    const lastCurrentIndex = current.matched.length - 1;
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      lastRouteIndex === lastCurrentIndex &&
      route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
    ) {
      this.ensureURL();
      if (route.hash) {
        handleScroll(this.router, current, route, false);
      }
      return abort(createNavigationDuplicatedError(current, route))
    }

    const { updated, deactivated, activated } = resolveQueue(
      this.current.matched,
      route.matched
    );

    const queue = [].concat(
      // in-component leave guards
      extractLeaveGuards(deactivated),
      // global before hooks
      this.router.beforeHooks,
      // in-component update hooks
      extractUpdateHooks(updated),
      // in-config enter guards
      activated.map(m => m.beforeEnter),
      // async components
      resolveAsyncComponents(activated)
    );

    const iterator = (hook, next) => {
      if (this.pending !== route) {
        return abort(createNavigationCancelledError(current, route))
      }
      try {
        hook(route, current, (to) => {
          if (to === false) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true);
            abort(createNavigationAbortedError(current, route));
          } else if (isError(to)) {
            this.ensureURL(true);
            abort(to);
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort(createNavigationRedirectedError(current, route));
            if (typeof to === 'object' && to.replace) {
              this.replace(to);
            } else {
              this.push(to);
            }
          } else {
            // confirm transition and pass on the value
            next(to);
          }
        });
      } catch (e) {
        abort(e);
      }
    };

    runQueue(queue, iterator, () => {
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated);
      const queue = enterGuards.concat(this.router.resolveHooks);
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort(createNavigationCancelledError(current, route))
        }
        this.pending = null;
        onComplete(route);
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            handleRouteEntered(route);
          });
        }
      });
    });
  }

  updateRoute (route) {
    this.current = route;
    this.cb && this.cb(route);
  }

  setupListeners () {
    // Default implementation is empty
  }

  teardown () {
    // clean up event listeners
    // https://github.com/vuejs/vue-router/issues/2341
    this.listeners.forEach(cleanupListener => {
      cleanupListener();
    });
    this.listeners = [];

    // reset current history route
    // https://github.com/vuejs/vue-router/issues/3294
    this.current = START;
    this.pending = null;
  }
}

function normalizeBase (base) {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base');
      base = (baseEl && baseEl.getAttribute('href')) || '/';
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '');
    } else {
      base = '/';
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base;
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

function resolveQueue (
  current,
  next
) {
  let i;
  const max = Math.max(current.length, next.length);
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

function extractGuards (
  records,
  name,
  bind,
  reverse
) {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = extractGuard(def, name);
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  });
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard (
  def,
  key
) {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def);
  }
  return def.options[key]
}

function extractLeaveGuards (deactivated) {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated) {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard, instance) {
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards (
  activated
) {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => {
      return bindEnterGuard(guard, match, key)
    }
  )
}

function bindEnterGuard (
  guard,
  match,
  key
) {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => {
      if (typeof cb === 'function') {
        if (!match.enteredCbs[key]) {
          match.enteredCbs[key] = [];
        }
        match.enteredCbs[key].push(cb);
      }
      next(cb);
    })
  }
}

/*  */

class HTML5History extends History {
  

  constructor (router, base) {
    super(router, base);

    this._startLocation = getLocation(this.base);
  }

  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router;
    const expectScroll = router.options.scrollBehavior;
    const supportsScroll = supportsPushState && expectScroll;

    if (supportsScroll) {
      this.listeners.push(setupScroll());
    }

    const handleRoutingEvent = () => {
      const current = this.current;

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base);
      if (this.current === START && location === this._startLocation) {
        return
      }

      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true);
        }
      });
    };
    window.addEventListener('popstate', handleRoutingEvent);
    this.listeners.push(() => {
      window.removeEventListener('popstate', handleRoutingEvent);
    });
  }

  go (n) {
    window.history.go(n);
  }

  push (location, onComplete, onAbort) {
    const { current: fromRoute } = this;
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath));
      handleScroll(this.router, route, fromRoute, false);
      onComplete && onComplete(route);
    }, onAbort);
  }

  replace (location, onComplete, onAbort) {
    const { current: fromRoute } = this;
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath));
      handleScroll(this.router, route, fromRoute, false);
      onComplete && onComplete(route);
    }, onAbort);
  }

  ensureURL (push) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath);
      push ? pushState(current) : replaceState(current);
    }
  }

  getCurrentLocation () {
    return getLocation(this.base)
  }
}

function getLocation (base) {
  let path = window.location.pathname;
  const pathLowerCase = path.toLowerCase();
  const baseLowerCase = base.toLowerCase();
  // base="/a" shouldn't turn path="/app" into "/a/pp"
  // https://github.com/vuejs/vue-router/issues/3555
  // so we ensure the trailing slash in the base
  if (base && ((pathLowerCase === baseLowerCase) ||
    (pathLowerCase.indexOf(cleanPath(baseLowerCase + '/')) === 0))) {
    path = path.slice(base.length);
  }
  return (path || '/') + window.location.search + window.location.hash
}

/*  */

class HashHistory extends History {
  constructor (router, base, fallback) {
    super(router, base);
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    ensureSlash();
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router;
    const expectScroll = router.options.scrollBehavior;
    const supportsScroll = supportsPushState && expectScroll;

    if (supportsScroll) {
      this.listeners.push(setupScroll());
    }

    const handleRoutingEvent = () => {
      const current = this.current;
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true);
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath);
        }
      });
    };
    const eventType = supportsPushState ? 'popstate' : 'hashchange';
    window.addEventListener(
      eventType,
      handleRoutingEvent
    );
    this.listeners.push(() => {
      window.removeEventListener(eventType, handleRoutingEvent);
    });
  }

  push (location, onComplete, onAbort) {
    const { current: fromRoute } = this;
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath);
        handleScroll(this.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  replace (location, onComplete, onAbort) {
    const { current: fromRoute } = this;
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath);
        handleScroll(this.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  go (n) {
    window.history.go(n);
  }

  ensureURL (push) {
    const current = this.current.fullPath;
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current);
    }
  }

  getCurrentLocation () {
    return getHash()
  }
}

function checkFallback (base) {
  const location = getLocation(base);
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location));
    return true
  }
}

function ensureSlash () {
  const path = getHash();
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path);
  return false
}

function getHash () {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href;
  const index = href.indexOf('#');
  // empty path
  if (index < 0) return ''

  href = href.slice(index + 1);

  return href
}

function getUrl (path) {
  const href = window.location.href;
  const i = href.indexOf('#');
  const base = i >= 0 ? href.slice(0, i) : href;
  return `${base}#${path}`
}

function pushHash (path) {
  if (supportsPushState) {
    pushState(getUrl(path));
  } else {
    window.location.hash = path;
  }
}

function replaceHash (path) {
  if (supportsPushState) {
    replaceState(getUrl(path));
  } else {
    window.location.replace(getUrl(path));
  }
}

/*  */

class AbstractHistory extends History {
  
  

  constructor (router, base) {
    super(router, base);
    this.stack = [];
    this.index = -1;
  }

  push (location, onComplete, onAbort) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index + 1).concat(route);
        this.index++;
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  replace (location, onComplete, onAbort) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index).concat(route);
        onComplete && onComplete(route);
      },
      onAbort
    );
  }

  go (n) {
    const targetIndex = this.index + n;
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    const route = this.stack[targetIndex];
    this.confirmTransition(
      route,
      () => {
        const prev = this.current;
        this.index = targetIndex;
        this.updateRoute(route);
        this.router.afterHooks.forEach(hook => {
          hook && hook(route, prev);
        });
      },
      err => {
        if (isNavigationFailure(err, NavigationFailureType.duplicated)) {
          this.index = targetIndex;
        }
      }
    );
  }

  getCurrentLocation () {
    const current = this.stack[this.stack.length - 1];
    return current ? current.fullPath : '/'
  }

  ensureURL () {
    // noop
  }
}

/*  */



class VueRouter {
  
  
  
  
  

  
  
  
  
  
  
  
  
  
  
  
  

  constructor (options = {}) {
    {
      warn(this instanceof VueRouter, `Router must be called with the new operator.`);
    }
    this.app = null;
    this.apps = [];
    this.options = options;
    this.beforeHooks = [];
    this.resolveHooks = [];
    this.afterHooks = [];
    this.matcher = createMatcher(options.routes || [], this);

    let mode = options.mode || 'hash';
    this.fallback =
      mode === 'history' && !supportsPushState && options.fallback !== false;
    if (this.fallback) {
      mode = 'hash';
    }
    if (!inBrowser) {
      mode = 'abstract';
    }
    this.mode = mode;

    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base);
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback);
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base);
        break
      default:
        {
          assert(false, `invalid mode: ${mode}`);
        }
    }
  }

  match (raw, current, redirectedFrom) {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  get currentRoute () {
    return this.history && this.history.current
  }

  init (app /* Vue component instance */) {
    assert(
        install.installed,
        `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
          `before creating root instance.`
      );

    this.apps.push(app);

    // set up app destroyed handler
    // https://github.com/vuejs/vue-router/issues/2639
    app.$once('hook:destroyed', () => {
      // clean out app from this.apps array once destroyed
      const index = this.apps.indexOf(app);
      if (index > -1) this.apps.splice(index, 1);
      // ensure we still have a main app or null if no apps
      // we do not release the router so it can be reused
      if (this.app === app) this.app = this.apps[0] || null;

      if (!this.app) this.history.teardown();
    });

    // main app previously initialized
    // return as we don't need to set up new history listener
    if (this.app) {
      return
    }

    this.app = app;

    const history = this.history;

    if (history instanceof HTML5History || history instanceof HashHistory) {
      const handleInitialScroll = routeOrError => {
        const from = history.current;
        const expectScroll = this.options.scrollBehavior;
        const supportsScroll = supportsPushState && expectScroll;

        if (supportsScroll && 'fullPath' in routeOrError) {
          handleScroll(this, routeOrError, from, false);
        }
      };
      const setupListeners = routeOrError => {
        history.setupListeners();
        handleInitialScroll(routeOrError);
      };
      history.transitionTo(
        history.getCurrentLocation(),
        setupListeners,
        setupListeners
      );
    }

    history.listen(route => {
      this.apps.forEach(app => {
        app._route = route;
      });
    });
  }

  beforeEach (fn) {
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve (fn) {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach (fn) {
    return registerHook(this.afterHooks, fn)
  }

  onReady (cb, errorCb) {
    this.history.onReady(cb, errorCb);
  }

  onError (errorCb) {
    this.history.onError(errorCb);
  }

  push (location, onComplete, onAbort) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.push(location, resolve, reject);
      })
    } else {
      this.history.push(location, onComplete, onAbort);
    }
  }

  replace (location, onComplete, onAbort) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.replace(location, resolve, reject);
      })
    } else {
      this.history.replace(location, onComplete, onAbort);
    }
  }

  go (n) {
    this.history.go(n);
  }

  back () {
    this.go(-1);
  }

  forward () {
    this.go(1);
  }

  getMatchedComponents (to) {
    const route = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute;
    if (!route) {
      return []
    }
    return [].concat.apply(
      [],
      route.matched.map(m => {
        return Object.keys(m.components).map(key => {
          return m.components[key]
        })
      })
    )
  }

  resolve (
    to,
    current,
    append
  ) {
    current = current || this.history.current;
    const location = normalizeLocation(to, current, append, this);
    const route = this.match(location, current);
    const fullPath = route.redirectedFrom || route.fullPath;
    const base = this.history.base;
    const href = createHref(base, fullPath, this.mode);
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  getRoutes () {
    return this.matcher.getRoutes()
  }

  addRoute (parentOrRoute, route) {
    this.matcher.addRoute(parentOrRoute, route);
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation());
    }
  }

  addRoutes (routes) {
    {
      warn(false, 'router.addRoutes() is deprecated and has been removed in Vue Router 4. Use router.addRoute() instead.');
    }
    this.matcher.addRoutes(routes);
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation());
    }
  }
}

function registerHook (list, fn) {
  list.push(fn);
  return () => {
    const i = list.indexOf(fn);
    if (i > -1) list.splice(i, 1);
  }
}

function createHref (base, fullPath, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath;
  return base ? cleanPath(base + '/' + path) : path
}

// We cannot remove this as it would be a breaking change
VueRouter.install = install;
VueRouter.version = '3.6.5';
VueRouter.isNavigationFailure = isNavigationFailure;
VueRouter.NavigationFailureType = NavigationFailureType;
VueRouter.START_LOCATION = START;

if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter);
}

const version = '3.6.5';

export { NavigationFailureType, Link as RouterLink, View as RouterView, START as START_LOCATION, VueRouter as default, isNavigationFailure, version };

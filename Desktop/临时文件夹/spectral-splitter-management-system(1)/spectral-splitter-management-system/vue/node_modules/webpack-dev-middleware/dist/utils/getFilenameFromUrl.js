"use strict";

const path = require("path");

const {
  parse
} = require("url");

const querystring = require("querystring");

const getPaths = require("./getPaths");
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */

/** @typedef {import("../index.js").ServerResponse} ServerResponse */


const cacheStore = new WeakMap();
/**
 * @param {Function} fn
 * @param {{ cache?: Map<any, any> }} [cache]
 * @returns {any}
 */

const mem = (fn, {
  cache = new Map()
} = {}) => {
  /**
   * @param {any} arguments_
   * @return {any}
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);

    if (cacheItem) {
      return cacheItem.data;
    }

    const result = fn.apply(void 0, arguments_);
    cache.set(key, {
      data: result
    });
    return result;
  };

  cacheStore.set(memoized, cache);
  return memoized;
};

const memoizedParse = mem(parse);
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 * @param {string} url
 * @returns {string | undefined}
 */

function getFilenameFromUrl(context, url) {
  const {
    options
  } = context;
  const paths = getPaths(context);
  let foundFilename;
  let urlObject;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return;
  }

  for (const {
    publicPath,
    outputPath
  } of paths) {
    let filename;
    let publicPathObject;

    try {
      publicPathObject = memoizedParse(publicPath !== "auto" && publicPath ? publicPath : "/", false, true);
    } catch (_ignoreError) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (urlObject.pathname && urlObject.pathname.startsWith(publicPathObject.pathname)) {
      filename = outputPath; // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`

      const pathname = urlObject.pathname.slice(publicPathObject.pathname.length);

      if (pathname) {
        filename = path.join(outputPath, querystring.unescape(pathname));
      }

      let fsStats;

      try {
        fsStats =
        /** @type {import("fs").statSync} */
        context.outputFileSystem.statSync(filename);
      } catch (_ignoreError) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (fsStats.isFile()) {
        foundFilename = filename;
        break;
      } else if (fsStats.isDirectory() && (typeof options.index === "undefined" || options.index)) {
        const indexValue = typeof options.index === "undefined" || typeof options.index === "boolean" ? "index.html" : options.index;
        filename = path.join(filename, indexValue);

        try {
          fsStats =
          /** @type {import("fs").statSync} */
          context.outputFileSystem.statSync(filename);
        } catch (__ignoreError) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (fsStats.isFile()) {
          foundFilename = filename;
          break;
        }
      }
    }
  } // eslint-disable-next-line consistent-return


  return foundFilename;
}

module.exports = getFilenameFromUrl;
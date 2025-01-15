// @ts-check
/** @typedef {import("../typings").Hooks} HtmlWebpackPluginHooks */
'use strict';
/**
 * This file provides access to all public htmlWebpackPlugin hooks
 */

/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("../index.js")} HtmlWebpackPlugin */

const AsyncSeriesWaterfallHook = require('tapable').AsyncSeriesWaterfallHook;

// The following is the API definition for all available hooks
// For the TypeScript definition, see the Hooks type in typings.d.ts
/**
  beforeAssetTagGeneration:
    AsyncSeriesWaterfallHook<{
      assets: {
        publicPath: string,
        js: Array<string>,
        css: Array<string>,
        favicon?: string | undefined,
        manifest?: string | undefined
      },
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  alterAssetTags:
    AsyncSeriesWaterfallHook<{
      assetTags: {
        scripts: Array<HtmlTagObject>,
        styles: Array<HtmlTagObject>,
        meta: Array<HtmlTagObject>,
      },
      publicPath: string,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  alterAssetTagGroups:
    AsyncSeriesWaterfallHook<{
      headTags: Array<HtmlTagObject | HtmlTagObject>,
      bodyTags: Array<HtmlTagObject | HtmlTagObject>,
      publicPath: string,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  afterTemplateExecution:
    AsyncSeriesWaterfallHook<{
      html: string,
      headTags: Array<HtmlTagObject | HtmlTagObject>,
      bodyTags: Array<HtmlTagObject | HtmlTagObject>,
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>,
  beforeEmit:
    AsyncSeriesWaterfallHook<{
      html: string,
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>,
  afterEmit:
    AsyncSeriesWaterfallHook<{
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>
*/

/**
 * @type {WeakMap<WebpackCompilation, HtmlWebpackPluginHooks>}}
 */
const htmlWebpackPluginHooksMap = new WeakMap();

/**
 * Returns all public hooks of the html webpack plugin for the given compilation
 *
 * @param {WebpackCompilation} compilation
 * @returns {HtmlWebpackPluginHooks}
 */
function getHtmlWebpackPluginHooks (compilation) {
  let hooks = htmlWebpackPluginHooksMap.get(compilation);
  // Setup the hooks only once
  if (hooks === undefined) {
    hooks = createHtmlWebpackPluginHooks();
    htmlWebpackPluginHooksMap.set(compilation, hooks);
  }
  return hooks;
}

/**
 * Add hooks to the webpack compilation object to allow foreign plugins to
 * extend the HtmlWebpackPlugin
 *
 * @returns {HtmlWebpackPluginHooks}
 */
function createHtmlWebpackPluginHooks () {
  return {
    beforeAssetTagGeneration: new AsyncSeriesWaterfallHook(['pluginArgs']),
    alterAssetTags: new AsyncSeriesWaterfallHook(['pluginArgs']),
    alterAssetTagGroups: new AsyncSeriesWaterfallHook(['pluginArgs']),
    afterTemplateExecution: new AsyncSeriesWaterfallHook(['pluginArgs']),
    beforeEmit: new AsyncSeriesWaterfallHook(['pluginArgs']),
    afterEmit: new AsyncSeriesWaterfallHook(['pluginArgs'])
  };
}

module.exports = {
  getHtmlWebpackPluginHooks
};

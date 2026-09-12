/**
 * This file is used to get the global instance for html-plugin.
 */

import { rspack } from '@rspack/core';
import { requireCompiledPackage } from './helpers/vendors';
import type { HtmlRspackPlugin, NormalizedEnvironmentConfig } from './types';

let htmlPlugin: typeof HtmlRspackPlugin;

export function getHTMLPlugin(config?: NormalizedEnvironmentConfig): typeof HtmlRspackPlugin {
  if (config?.html.implementation === 'native') {
    // TODO: remove type assertion
    return rspack.HtmlRspackPlugin as unknown as typeof HtmlRspackPlugin;
  }
  if (!htmlPlugin) {
    htmlPlugin = requireCompiledPackage('html-rspack-plugin');
  }
  return htmlPlugin;
}

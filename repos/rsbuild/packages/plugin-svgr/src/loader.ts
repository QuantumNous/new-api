/**
 * Copyright (c) 2017, Smooth Code
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * modified from https://github.com/gregberge/svgr/blob/7595d378b73d4826a4cead165b3f32386b07315b/packages/webpack/src/index.ts
 */

import { normalize } from 'node:path';
import { callbackify } from 'node:util';
import type { Rspack } from '@rsbuild/core';
import { type Config, type Plugin, type State, transform } from '@svgr/core';
import jsx from '@svgr/plugin-jsx';
import svgo from '@svgr/plugin-svgo';

const transformSvg = callbackify(async (contents: string, config: Config, state: Partial<State>) =>
  transform(contents, config, state),
);

const svgrLoader: Rspack.LoaderDefinition<Config> = function (contents): void {
  this?.cacheable();

  const callback = this.async();

  const options = this.getOptions();

  const previousExport = (() => {
    if (contents.startsWith('export ')) return contents;
    const exportMatches = contents.match(/^module.exports\s*=\s*(.*)/);
    return exportMatches ? `export default ${exportMatches[1]}` : null;
  })();

  const state: Partial<State> = {
    caller: {
      name: '@rsbuild/plugin-svgr',
      previousExport,
      defaultPlugins: [svgo, jsx] as unknown as Plugin[],
    },
    filePath: normalize(this.resourcePath),
  };

  if (!previousExport) {
    transformSvg(contents, options, state, callback);
  } else {
    this.fs.readFile(this.resourcePath, (err: Error, result: unknown) => {
      if (err) {
        callback(err);
        return;
      }
      transformSvg(String(result), options, state, (err, content) => {
        if (err) {
          callback(err);
          return;
        }
        callback(null, content);
      });
    });
  }
};

export default svgrLoader;

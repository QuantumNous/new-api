/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { compileString, Logger } from 'sass';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const {
  semiThemeLoader,
} = require('@douyinfe/vite-plugin-semi/lib/semi-theme-loader.js');

function transformPath(filePath) {
  return process.platform === 'win32'
    ? filePath.replace(/[\\]+/g, '/')
    : filePath;
}

function convertMapToString(map) {
  return Object.keys(map).reduce((prev, curr) => {
    return `${prev}${curr}: ${map[curr]};\n`;
  }, '');
}

function resolveSemiImport(importPath, scssFilePath, projectRoot) {
  if (importPath.startsWith('~')) {
    const request = importPath.slice(1);
    try {
      const resolvedPath = require.resolve(request, {
        paths: [path.dirname(scssFilePath), projectRoot],
      });
      return pathToFileURL(resolvedPath);
    } catch {
      return null;
    }
  }

  const filePath = path.resolve(path.dirname(scssFilePath), importPath);
  if (fs.existsSync(filePath)) {
    return pathToFileURL(filePath);
  }
  return null;
}

export default function vitePluginSemiCompat(options = {}) {
  const projectRoot = process.cwd();

  return {
    name: 'vite-plugin-semi-compat',
    load(id) {
      const filePath = transformPath(id);
      if (options.include) {
        options.include = transformPath(options.include);
      }

      if (
        !/@douyinfe\/semi-(ui|icons|foundation)\/lib\/.+\.css$/.test(filePath)
      ) {
        return null;
      }

      const scssFilePath = filePath.replace(/\.css$/, '.scss');
      const semiLoaderOptions = {
        name:
          typeof options.theme === 'string'
            ? options.theme
            : options.theme?.name,
        cssLayer: options.cssLayer,
        variables: convertMapToString(options.variables || {}),
      };

      const originalScssRaw = fs.readFileSync(scssFilePath, 'utf-8');
      const themedScss = semiThemeLoader(originalScssRaw, semiLoaderOptions);

      return compileString(themedScss, {
        importers: [
          {
            findFileUrl(url) {
              return resolveSemiImport(url, scssFilePath, projectRoot);
            },
          },
        ],
        logger: Logger.silent,
      }).css;
    },
  };
}

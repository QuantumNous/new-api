import fs from 'node:fs/promises';
import path from 'node:path';
import { createRsbuild } from '@rsbuild/core';
import { createRsbuild as createRsbuildV1 } from '@rsbuild/core-v1';
import { pluginReact } from '@rsbuild/plugin-react';
import { matchRules } from '@scripts/test-helper';
import { type PluginSvgrOptions, pluginSvgr } from '../src';

describe('svgr', () => {
  const cases: Array<{ name: string; pluginConfig: PluginSvgrOptions }> = [
    {
      name: 'exportType named / mixedImport true',
      pluginConfig: {
        svgrOptions: {
          exportType: 'named',
        },
        mixedImport: true,
      },
    },
    {
      name: 'exportType named / mixedImport false',
      pluginConfig: {
        svgrOptions: {
          exportType: 'named',
        },
        mixedImport: false,
      },
    },
    {
      name: 'exportType default / mixedImport false',
      pluginConfig: {
        svgrOptions: {
          exportType: 'default',
        },
        mixedImport: false,
      },
    },
    {
      name: 'exportType default / mixedImport true',
      pluginConfig: {
        svgrOptions: {
          exportType: 'default',
        },
        mixedImport: true,
      },
    },
    {
      name: 'configure SVGR options',
      pluginConfig: {
        svgrOptions: {
          svgoConfig: {
            datauri: 'base64',
          },
        },
      },
    },
  ];

  it.each(cases)('$name', async (item) => {
    const rsbuild = await createRsbuild({
      cwd: import.meta.dirname,
      config: {
        mode: 'development',
        plugins: [pluginSvgr(item.pluginConfig), pluginReact()],
      },
    });

    const config = await rsbuild.initConfigs();
    expect(matchRules(config[0], 'a.svg')[0]).toMatchSnapshot();
  });

  it('should throw an error when using Rsbuild v1', async () => {
    const rsbuild = await createRsbuildV1({
      config: {
        plugins: [pluginSvgr()],
      },
    });

    await expect(() => rsbuild.initConfigs()).rejects.toThrow(
      /"@rsbuild\/plugin-svgr" v2 requires "@rsbuild\/core" >= 2\.0\. Please upgrade "@rsbuild\/core" or use "@rsbuild\/plugin-svgr" v1\./,
    );
  });

  it('should publish as a pure ESM package', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(import.meta.dirname, '../package.json'), 'utf8'),
    ) as {
      exports: {
        '.': {
          default: string;
          require?: string;
          types: string;
        };
      };
    };

    expect(packageJson.exports['.']).toEqual({
      types: './dist/index.d.ts',
      default: './dist/index.js',
    });
  });
});

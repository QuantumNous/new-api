import { createRsbuild } from '@rsbuild/core';
import { pluginReact } from '../src';

describe('splitChunks', () => {
  it('should apply antd/semi/... splitChunks rule when pkg is installed', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {},
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();

    expect(config[0]?.optimization?.splitChunks).toMatchSnapshot();
  });

  it('should not apply splitChunks rule when strategy is not split-by-experience', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {
          chunkSplit: {
            strategy: 'single-vendor',
          },
        },
      },
    });

    rsbuild.addPlugins([pluginReact()]);

    const config = await rsbuild.initConfigs();

    expect(config[0]?.optimization?.splitChunks).toMatchSnapshot();
  });

  it('should apply splitChunks.react/router plugin option when strategy is split-by-experience', async () => {
    const rsbuild = await createRsbuild({
      config: {
        performance: {
          chunkSplit: {
            strategy: 'split-by-experience',
          },
        },
      },
    });

    rsbuild.addPlugins([
      pluginReact({
        splitChunks: {
          react: false,
          router: false,
        },
      }),
    ]);

    const config = await rsbuild.initConfigs();
    expect(config[0]?.optimization?.splitChunks).toMatchSnapshot();
  });
});

import { createRsbuild } from '@rsbuild/core';
import { matchRules } from '@scripts/test-helper';
import { pluginLess } from '../src';

describe('plugin-less', () => {
  it('should add less-loader', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [pluginLess()],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.less')).toMatchSnapshot();
  });

  it('should add less-loader and css-loader when injectStyles', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [pluginLess()],
        output: {
          injectStyles: true,
        },
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.less')).toMatchSnapshot();
  });

  it('should add less-loader with tools.less', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginLess({
            lessLoaderOptions: {
              lessOptions: {
                javascriptEnabled: false,
              },
            },
          }),
        ],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.less')).toMatchSnapshot();
  });

  it('should add less-loader with excludes', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginLess({
            lessLoaderOptions(_config, { addExcludes }) {
              addExcludes(/node_modules/);
            },
          }),
        ],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.less')).toMatchSnapshot();
  });

  it('should allow to use Less plugins', async () => {
    class MockPlugin {
      options?: unknown;
      constructor(options?: unknown) {
        this.options = options;
      }
      install() {}
    }

    const mockPlugin = new MockPlugin({ foo: 'bar' });
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginLess({
            lessLoaderOptions: {
              lessOptions: {
                plugins: [mockPlugin],
              },
            },
          }),
        ],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();

    expect(matchRules(rspackConfigs[0], 'a.less')).toMatchSnapshot();
  });

  it('should allow to add multiple less rules', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [
          pluginLess({
            include: [/a\.less/, /b\.less/],
          }),
          pluginLess({
            include: /b\.less/,
          }),
        ],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.less').length).toBe(1);
    expect(matchRules(rspackConfigs[0], 'b.less').length).toBe(2);
  });
});

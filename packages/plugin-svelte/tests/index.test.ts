import { createRsbuild } from '@rsbuild/core';
import { matchRules } from '@scripts/test-helper';
import { pluginSvelte } from '../src';

describe('plugin-svelte', () => {
  afterEach(() => {
    rs.unstubAllEnvs();
  });

  it('should add svelte loader and resolve config properly', async () => {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        plugins: [pluginSvelte()],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte')).toMatchSnapshot();
    expect(rspackConfigs[0].resolve).toMatchSnapshot();
  });

  it('should add rule for `.svelte.js` and `.svelte.ts` as expected', async () => {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        plugins: [pluginSvelte()],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte.js')).toMatchSnapshot();
    expect(matchRules(rspackConfigs[0], 'a.svelte.ts')).toMatchSnapshot();
  });

  it('should set dev and hotReload to false in production mode', async () => {
    rs.stubEnv('NODE_ENV', 'production');
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        plugins: [pluginSvelte()],
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte')).toMatchSnapshot();
  });

  it('should turn off HMR by hand correctly', async () => {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        dev: {
          hmr: false,
        },
        plugins: [pluginSvelte()],
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte')).toMatchSnapshot();
  });

  it('should override default svelte-loader options throw options.svelteLoaderOptions', async () => {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        plugins: [
          pluginSvelte({
            svelteLoaderOptions: {
              preprocess: null,
            },
          }),
        ],
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte')).toMatchSnapshot();
  });

  it('should support pass custom preprocess options', async () => {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      config: {
        plugins: [
          pluginSvelte({
            preprocessOptions: {
              aliases: [
                ['potato', 'potatoLanguage'],
                ['pot', 'potatoLanguage'],
              ],
              /** Add a custom language preprocessor */
              potatoLanguage: ({ content }: { content: string }) => {
                const { code, map } =
                  // rslint-disable-next-line @typescript-eslint/no-require-imports
                  require('potato-language').render(content);
                return { code, map };
              },
            },
          }),
        ],
      },
    });
    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.svelte')).toMatchSnapshot();
  });
});

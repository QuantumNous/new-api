import { matchRules } from '@scripts/test-helper';
import { createRsbuild } from '../src';

describe('plugin-node-addons', () => {
  it('should add node addons rule properly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'node',
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];

    expect(matchRules(config, 'a.node')).toMatchSnapshot();
  });

  it('should not add node addons rule when target is web', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'web',
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];

    expect(matchRules(config, 'a.node')).toEqual([]);
  });

  it('should not add node addons rule when target is web-worker', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          target: 'web-worker',
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];

    expect(matchRules(config, 'a.node')).toEqual([]);
  });
});

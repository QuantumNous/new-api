import { matchRules } from '@scripts/test-helper';
import { createRsbuild } from '../src';

describe('plugin-wasm', () => {
  it('should add wasm rule properly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          distPath: {
            wasm: 'static/wasm',
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];

    expect(matchRules(config, 'a.wasm')).toMatchSnapshot();
  });
});

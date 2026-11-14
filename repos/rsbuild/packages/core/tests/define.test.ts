import { matchPlugin } from '@scripts/test-helper';
import { createRsbuild } from '../src';

describe('plugin-define', () => {
  test('should register define plugin correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        source: {
          define: {
            NAME: JSON.stringify('Jack'),
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchPlugin(config, 'DefinePlugin')).toMatchSnapshot();
  });
});

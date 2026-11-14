import { rspack } from '@rspack/core';
import { stringifyConfig } from '../src/inspectConfig';

describe('stringifyConfig', () => {
  it('should stringify Rspack config correctly', async () => {
    const { DefinePlugin } = rspack;
    const config = {
      mode: 'development',
      plugins: [new DefinePlugin({ foo: 'bar' })],
    };

    expect(stringifyConfig(config)).toMatchSnapshot();
  });

  it('should stringify Rspack config with verbose option correctly', async () => {
    const { DefinePlugin } = rspack;
    const config = {
      mode: 'development',
      output: {
        filename() {
          const a = '[name.js]';
          return a;
        },
      },
      plugins: [
        new DefinePlugin({
          foo: 'bar',
        }),
      ],
    };

    expect(stringifyConfig(config, true)).toMatchSnapshot();
  });

  it('should stringify Rsbuild config correctly', async () => {
    const config = {
      tools: {
        bundlerChain(chain: any) {
          chain.devtool('eval');
        },
      },
    };

    expect(stringifyConfig(config)).toMatchSnapshot();
  });
});

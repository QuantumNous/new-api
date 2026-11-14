import { createRsbuild } from '@rsbuild/core';
import { matchRules } from '@scripts/test-helper';
import { pluginTailwindcss } from '../src';

describe('plugin-tailwindcss', () => {
  it('should add tailwindcss loader to CSS rule', async () => {
    const rsbuild = await createRsbuild({
      config: {
        plugins: [pluginTailwindcss()],
      },
    });

    const rspackConfigs = await rsbuild.initConfigs();
    expect(matchRules(rspackConfigs[0], 'a.css')).toMatchSnapshot();
  });
});

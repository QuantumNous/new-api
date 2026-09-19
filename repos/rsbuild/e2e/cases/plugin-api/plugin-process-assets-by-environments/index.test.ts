import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import type { RsbuildPluginAPI } from '@rsbuild/core';

test('should allow plugin to process assets by environments', async ({ build }) => {
  const rsbuild = await build();
  expect(existsSync(join(rsbuild.distPath, 'static/index.js'))).toBeFalsy();
  expect(existsSync(join(rsbuild.distPath, 'server/index.js'))).toBeTruthy();
});

test('should filter environments correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [
        {
          name: 'my-plugin-node',
          setup(api: RsbuildPluginAPI) {
            api.processAssets(
              { stage: 'summarize', environments: ['node'] },
              ({ assets, compilation }) => {
                for (const key of Object.keys(assets)) {
                  if (key.endsWith('.js')) {
                    compilation.deleteAsset(key);
                  }
                }
              },
            );
          },
        },
      ],
    },
  });

  expect(existsSync(join(rsbuild.distPath, 'static/index.js'))).toBeFalsy();
  expect(existsSync(join(rsbuild.distPath, 'server/index.js'))).toBeFalsy();
});

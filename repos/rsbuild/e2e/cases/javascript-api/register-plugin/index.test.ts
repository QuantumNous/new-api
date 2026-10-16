import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';
import { pluginVue } from '@rsbuild/plugin-vue';

test('should register plugins correctly when using JavaScript API', async ({ build }) => {
  await build({
    config: {
      plugins: [pluginVue()],
    },
  });

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('index.html'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('static/js/index.'))).toBeTruthy();
});

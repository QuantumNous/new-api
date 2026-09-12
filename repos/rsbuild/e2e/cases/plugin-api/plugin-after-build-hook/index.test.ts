import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { createRsbuild, type RsbuildPlugin } from '@rsbuild/core';
import fse from 'fs-extra';

const distFile = path.join(import.meta.dirname, 'node_modules/hooksTempFile');

const write = (str: string) => {
  let content: string;
  if (fs.existsSync(distFile)) {
    content = `${fs.readFileSync(distFile, 'utf-8')},${str}`;
  } else {
    content = str;
  }
  fse.outputFileSync(distFile, content);
};

const plugin: RsbuildPlugin = {
  name: 'test-plugin',
  setup(api) {
    api.onAfterBuild(async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          write('1');
          resolve();
        }, 10);
      });
    });
  },
};

test('should run onAfterBuild hooks correctly when have multiple targets', async () => {
  await fse.remove(distFile);

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [plugin],
      environments: {
        web: {},
        node: {
          output: {
            target: 'node',
          },
        },
      },
    },
  });

  await rsbuild.build();
  write('2');

  expect(fs.readFileSync(distFile, 'utf-8').split(',')).toEqual(['1', '2']);
});

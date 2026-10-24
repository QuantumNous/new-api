import fs from 'node:fs';
import path from 'node:path';
import { createRsbuild } from '@rsbuild/core';
import fse from 'fs-extra';

const distFile = path.join(import.meta.dirname, 'node_modules/hooksTempFile');

const write = (str) => {
  let content;
  if (fs.existsSync(distFile)) {
    content = `${fs.readFileSync(distFile, 'utf-8')},${str}`;
  } else {
    content = str;
  }
  fse.outputFileSync(distFile, content);
};

const plugin = {
  name: 'test-plugin',
  setup(api) {
    api.onExit(({ exitCode }) => {
      write(exitCode.toString());
    });
  },
};

async function main() {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [plugin],
    },
  });

  await rsbuild.build();
}

await main();

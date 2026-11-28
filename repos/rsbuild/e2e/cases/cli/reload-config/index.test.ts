import fs from 'node:fs';
import path from 'node:path';
import { test } from '@e2e/helper';
import { getRandomPort, waitForFile } from '@rstackjs/test-utils';
import fse from 'fs-extra';

test('should restart dev server and reload config when config file changed', async ({
  prepareDist,
  execCli,
}) => {
  const configFile = path.join(import.meta.dirname, 'rsbuild.config.mjs');

  const dist1 = await prepareDist();
  const dist2 = await prepareDist('dist-2');
  await fse.remove(configFile);

  fs.writeFileSync(
    configFile,
    `export default {
      dev: {
        writeToDisk: true,
      },
      server: { port: ${await getRandomPort()} }
    };`,
  );

  execCli('dev');

  await waitForFile(dist1);

  fs.writeFileSync(
    configFile,
    `export default {
      dev: {
        writeToDisk: true,
      },
      output: {
        distPath: 'dist-2',
      },
      server: { port: ${await getRandomPort()} }
    };`,
  );

  await waitForFile(dist2);
});

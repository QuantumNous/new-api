import fs from 'node:fs';
import path from 'node:path';
import { expectFile, getRandomPort, test } from '@e2e/helper';
import fse from 'fs-extra';

test('should restart dev server and reload config when config file changed', async ({
  execCli,
}) => {
  const dist1 = path.join(import.meta.dirname, 'dist');
  const dist2 = path.join(import.meta.dirname, 'dist-2');
  const configFile = path.join(import.meta.dirname, 'rsbuild.config.mjs');

  await fse.remove(dist1);
  await fse.remove(dist2);
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

  await expectFile(dist1);

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

  await expectFile(dist2);
});

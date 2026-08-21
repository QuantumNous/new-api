import fs from 'node:fs';
import path from 'node:path';
import { test } from '@e2e/helper';
import { getRandomPort, waitForFileContent } from '@rstackjs/test-utils';

test('should restart dev server when .env file is changed', async ({ execCli, logHelper }) => {
  const dist = path.join(import.meta.dirname, 'dist');
  const configFile = path.join(import.meta.dirname, 'rsbuild.config.mjs');
  const envLocalFile = path.join(import.meta.dirname, '.env.local');
  const distIndex = path.join(dist, 'static/js/index.js');

  fs.writeFileSync(envLocalFile, 'PUBLIC_NAME=jack');
  fs.writeFileSync(
    configFile,
    `export default {
      dev: {
        writeToDisk: true,
      },
      output: {
        filenameHash: false,
      },
      server: { port: ${await getRandomPort()} }
    };`,
  );

  execCli('dev');
  const { clearLogs, expectLog, expectBuildEnd } = logHelper;

  await expectBuildEnd();
  await waitForFileContent(distIndex, 'jack');

  clearLogs();
  fs.writeFileSync(envLocalFile, 'PUBLIC_NAME=rose');
  await expectLog('restarting server');
  await expectBuildEnd();
  await waitForFileContent(distIndex, 'rose');
});

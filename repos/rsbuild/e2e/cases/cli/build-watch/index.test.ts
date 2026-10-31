import path from 'node:path';
import { test } from '@e2e/helper';
import { waitForFileContent } from '@rstackjs/test-utils';
import fse from 'fs-extra';

test('should support watch mode for build command', async ({ execCli, logHelper }) => {
  const indexFile = path.join(import.meta.dirname, 'src/index.js');
  const distIndexFile = path.join(import.meta.dirname, 'dist/static/js/index.js');

  fse.outputFileSync(indexFile, `console.log('hello!');`);

  execCli('build --watch');
  const { expectBuildEnd, clearLogs, expectLog } = logHelper;

  await expectBuildEnd();
  await waitForFileContent(distIndexFile, 'hello!');
  clearLogs();

  fse.outputFileSync(indexFile, `console.log('hello2!');`);
  await expectLog('building src/index.js', { posix: true });
  await expectBuildEnd();
  await waitForFileContent(distIndexFile, 'hello2!');
});

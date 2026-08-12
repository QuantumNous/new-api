import path from 'node:path';
import { expectFileWithContent, test } from '@e2e/helper';
import fse from 'fs-extra';

test('should allow to custom watch options for build watch', async ({
  execCli,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const distIndexFile = path.join(import.meta.dirname, 'dist/static/js/index.js');
  const fooFile = path.join(tempSrc, 'foo.js');
  const barFile = path.join(tempSrc, 'bar.js');

  execCli('build --watch');
  const { expectLog, expectNoLog, expectBuildEnd, clearLogs } = logHelper;

  await expectBuildEnd();
  await expectFileWithContent(distIndexFile, 'foo1bar1');
  clearLogs();

  // should watch foo.js
  fse.outputFileSync(fooFile, `export const foo = 'foo2';`);
  await expectLog('building test-temp-src/foo.js', { posix: true });
  await expectBuildEnd();
  await expectFileWithContent(distIndexFile, 'foo2bar1');

  // should not watch bar.js
  fse.outputFileSync(barFile, `export const bar = 'bar2';`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expectNoLog('building test-temp-src/bar.js', { posix: true });
});

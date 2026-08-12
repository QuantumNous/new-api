import { join } from 'node:path';
import { expect, expectFile, getRandomPort, gotoPage, test } from '@e2e/helper';
import fse from 'fs-extra';
import { tempConfig } from './rsbuild.config';

test('should watch tsconfig.json and reload the server when it changes', async ({
  page,
  editFile,
  execCli,
}) => {
  const dist = join(import.meta.dirname, 'dist');

  await fse.remove(dist);
  await fse.remove(tempConfig);
  await fse.copy(join(import.meta.dirname, 'tsconfig.json'), tempConfig);

  const port = await getRandomPort();
  execCli('dev', {
    env: {
      PORT: String(port),
    },
  });

  await expectFile(dist);
  await gotoPage(page, { port });
  await expect(page.locator('#content')).toHaveText('foo');

  await editFile(tempConfig, (code) => code.replace('foo', 'bar'));
  await expect(page.locator('#content')).toHaveText('bar');
});

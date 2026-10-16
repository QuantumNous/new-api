import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should reload page when HTML template changed', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  await dev();

  await expect(page).toHaveTitle('Foo');

  await editFile(join(tempSrc, 'index.html'), (code) => code.replace('Foo', 'Bar'));
  // expect page title to be 'Bar' after HTML template changed
  await expect(page).toHaveTitle('Bar');
});

test('should not reload page when HTML live reload is disabled', async ({
  page,
  dev,
  editFile,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  await dev({
    config: {
      dev: {
        liveReload: {
          html: false,
        },
      },
    },
  });

  await expect(page).toHaveTitle('Foo');

  logHelper.clearLogs();
  await editFile(join(tempSrc, 'index.html'), (code) => code.replace('Foo', 'Bar'));
  await logHelper.expectBuildEnd();
  // Title unchanged
  await expect(page).toHaveTitle('Foo');
});

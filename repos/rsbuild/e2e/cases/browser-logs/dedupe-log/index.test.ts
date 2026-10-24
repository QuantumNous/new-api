import { join } from 'node:path';
import { gotoPage, test } from '@e2e/helper';

test('should not output the same browser log', async ({ devOnly, page, editFile, copySrcDir }) => {
  const tempSrc = await copySrcDir();

  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.js'),
        },
      },
    },
  });

  // initial build
  await gotoPage(page, rsbuild, '/', { hash: 'test1' });
  await rsbuild.expectLog('Error: value is #test1');
  rsbuild.clearLogs();

  // change hash
  await gotoPage(page, rsbuild, '/', { hash: 'test2' });
  await page.reload();
  await rsbuild.expectLog('Error: value is #test2');
  rsbuild.expectNoLog('Error: value is #test1');
  rsbuild.clearLogs();

  // after rebuild, logs can be printed again
  await editFile(join(tempSrc, 'index.js'), (content) => content.replace('value', 'value2'));
  await rsbuild.expectLog('Error: value2 is #test2');
  await gotoPage(page, rsbuild, '/', { hash: 'test1' });
  await page.reload();
  await rsbuild.expectLog('Error: value2 is #test1');
});

import path from 'node:path';
import { expectPoll, test } from '@e2e/helper';

test('should trigger the client HMR handler when dev server sends a custom message', async ({
  page,
  dev,
}) => {
  const { server } = await dev();
  const before = await page.evaluate<number>('window.__count');

  server?.environments.web.hot.send('custom', { event: 'count' });

  await expectPoll(() => page.evaluate<number>('window.__count')).toBe(before + 1);
});

test('should dispose old HMR event callbacks after page reload', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const srcDir = await copySrcDir();
  const indexPath = path.join(srcDir, 'index.ts');
  const { server } = await dev({
    config: {
      source: {
        entry: {
          index: indexPath,
        },
      },
    },
  });

  // 1) Trigger once and assert callback executed.
  const afterFirst = await page.evaluate<number>('window.__count');
  server?.environments.web.hot.send('custom', { event: 'count' });
  await expectPoll(() => page.evaluate<number>('window.__count')).toBe(afterFirst + 1);

  // 2) Modify the source file to trigger an HMR update.
  await editFile(indexPath, (content) => content.replace('hello', 'hi'));

  // 3) Trigger again. If old callback leaked, we'd observe multiple runs.
  await expectPoll(() => page.evaluate<number>('window.__count')).toBe(afterFirst + 1);
  server?.environments.web.hot.send('custom', { event: 'count' });
  await expectPoll(() => page.evaluate<number>('window.__count')).toBe(afterFirst + 2);
});

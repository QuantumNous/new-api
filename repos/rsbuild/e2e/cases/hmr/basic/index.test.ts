import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should perform HMR and preserve state', async ({ page, dev, editFile, copySrcDir }) => {
  const tempSrc = await copySrcDir();

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
  await expect(locator).toHaveCSS('color', 'rgb(255, 0, 0)');

  const locatorKeep = page.locator('#test-keep');
  const keepNum = await locatorKeep.innerHTML();

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('Hello Rsbuild', 'Hello Test'));

  await expect(locator).toHaveText('Hello Test!');
  // #test-keep should remain unchanged when app.tsx HMR
  expect(await locatorKeep.innerHTML()).toBe(keepNum);

  await editFile(join(tempSrc, 'App.css'), () => `#test { color: rgb(0, 0, 255); }`);
  await expect(locator).toHaveCSS('color', 'rgb(0, 0, 255)');
});

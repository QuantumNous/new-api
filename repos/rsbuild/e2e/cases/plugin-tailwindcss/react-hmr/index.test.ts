import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should support Tailwind CSS HMR in React components', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  const button = page.locator('#button');
  await expect(button).toHaveText('count: 0');
  await expect(button).toHaveCSS('background-color', 'rgb(18, 52, 86)');

  await button.click();
  await expect(button).toHaveText('count: 1');

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('bg-[#123456]', 'bg-[#654321]'));

  await expect(button).toHaveText('count: 1');
  await expect(button).toHaveCSS('background-color', 'rgb(101, 67, 33)');
});

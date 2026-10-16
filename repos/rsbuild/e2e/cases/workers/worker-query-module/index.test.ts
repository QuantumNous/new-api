import { expect, test } from '@e2e/helper';

test('should support worker query imports with output.module enabled', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async ({ mode, result }) => {
    await expect(page.locator('#worker')).toHaveText('worker: msg');
    await expect(page.locator('#inline')).toHaveText('inline: msg');

    if (mode === 'build') {
      const files = result.getDistFiles();
      const indexFile = Object.keys(files).find((filename) =>
        /\/static\/js\/index\.[\w-]+\.js$/.test(filename),
      );

      expect(indexFile).toBeDefined();
      expect(files[indexFile!]).toContain('type:"module"');
    }
  });
});

import { expect, test } from '@e2e/helper';

test('should inline dynamic imports in inline worker query imports', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async ({ mode, result }) => {
    await expect(page.locator('#result')).toHaveText('inline: dynamic inline-dynamic-marker');

    if (mode === 'build') {
      const files = result.getDistFiles();
      const jsFiles = Object.entries(files).filter(([filename]) => filename.endsWith('.js'));

      expect(jsFiles).toHaveLength(1);
      expect(jsFiles[0][1]).toContain('inline-dynamic-marker');
      expect(jsFiles[0][1]).toContain(': dynamic');
    }
  });
});

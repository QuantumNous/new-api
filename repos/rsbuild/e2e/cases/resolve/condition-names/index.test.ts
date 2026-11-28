import { expect, test } from '@e2e/helper';

declare global {
  interface Window {
    test: string;
  }
}

test('should apply resolve.conditionNames as expected', async ({
  copyNodeModules,
  page,
  runBothServe,
}) => {
  await copyNodeModules();

  await runBothServe(
    async () => {
      expect(await page.evaluate(() => window.test)).toBe('custom');
    },
    {
      config: {
        resolve: {
          conditionNames: ['custom', 'import', 'require'],
        },
      },
    },
  );

  await runBothServe(
    async () => {
      // The key order in the `exports` object determines priority
      expect(await page.evaluate(() => window.test)).toBe('import');
    },
    {
      config: {
        resolve: {
          conditionNames: ['require', 'import'],
        },
      },
    },
  );
});

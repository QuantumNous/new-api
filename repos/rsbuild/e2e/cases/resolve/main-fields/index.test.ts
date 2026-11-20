import { expect, test } from '@e2e/helper';

declare global {
  interface Window {
    test: string;
  }
}

test('should apply resolve.mainFields as expected', async ({
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
          mainFields: ['custom', 'module', 'main'],
        },
      },
    },
  );

  await runBothServe(
    async () => {
      expect(await page.evaluate(() => window.test)).toBe('main');
    },
    {
      config: {
        resolve: {
          mainFields: ['main', 'module'],
        },
      },
    },
  );
});

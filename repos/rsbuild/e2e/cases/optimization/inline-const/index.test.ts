import { expect, test } from '@e2e/helper';

test('should inline the constants as expected', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    await page.waitForFunction(() => window.testDog);
    expect(await page.evaluate(() => window.testFish)).toBe('fish,FISH');
    expect(await page.evaluate(() => window.testCat)).toBe('cat,CAT');
    expect(await page.evaluate(() => window.testDog)).toBe('dog,DOG');
    expect(await page.evaluate(() => window.testNamespace)).toBe('0,1');

    if (mode === 'build') {
      const indexJs = await result.getIndexBundle();
      expect(indexJs).toContain('window.testFish="fish,FISH"');
      expect(indexJs).toContain('window.testCat="cat,CAT"');
      expect(indexJs).toContain('window.testNamespace="0,1"');
    }
  });
});

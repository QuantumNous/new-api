import { expect, test } from '@e2e/helper';

test('should allow to use the `using` declaration for explicit resource management', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.disposeCounter')).toEqual(4);
  });
});

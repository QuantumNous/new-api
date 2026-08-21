import { expect, test } from '@e2e/helper';

test('should resolve package.json#imports keys starting with #/', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    const foo = page.locator('#foo');
    await expect(foo).toHaveText('foo from #/');
  });
});

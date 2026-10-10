import { expect, test } from '@e2e/helper';

test('should compile SVG React components with `parallel` option', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    for (const id of ['icon-a', 'icon-b', 'icon-c', 'icon-d', 'icon-e']) {
      await expect(page.locator(`#${id}`)).toHaveJSProperty('tagName', 'svg');
    }
  });
});

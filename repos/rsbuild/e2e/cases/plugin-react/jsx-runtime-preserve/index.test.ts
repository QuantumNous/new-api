import { expect, test } from '@e2e/helper';

test('should preserve JSX after build', async ({ build }) => {
  const result = await build();
  const content = await result.getIndexBundle();
  expect(content.includes('<div id="test">Hello Rsbuild!</div>')).toBeTruthy();
});

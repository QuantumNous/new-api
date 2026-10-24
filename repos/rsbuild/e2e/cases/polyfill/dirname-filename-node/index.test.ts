import { expect, test } from '@e2e/helper';

test('should not polyfill dirname and filename in node target when output.module is enabled', async ({
  build,
}) => {
  const rsbuild = await build();
  const content = await rsbuild.getIndexBundle();
  expect(content).toContain(`'__dirname', __dirname`);
  expect(content).toContain(`'__filename', __filename`);
  expect(content).toContain(`'import.meta.dirname', import.meta.dirname`);
  expect(content).toContain(`'import.meta.filename', import.meta.filename`);
});

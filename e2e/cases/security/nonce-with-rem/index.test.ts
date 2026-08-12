import { expect, getFileContent, test } from '@e2e/helper';

test('should inject rem runtime code with nonce', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');
  expect(html).toContain(`<script nonce="CSP_NONCE_PLACEHOLDER">function setRootPixel`);
});

import { expect, getFileContent, test } from '@e2e/helper';

test('should apply nonce to script and style tags', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');
  expect(html).toContain(`<script defer nonce="CSP_NONCE_PLACEHOLDER">`);
  expect(html).toContain(`<style nonce="CSP_NONCE_PLACEHOLDER">body{`);
});

test('should apply environment nonce', async ({ build }) => {
  const rsbuild = await build({
    config: {
      environments: {
        web: {
          security: {
            nonce: 'CSP_NONCE_PLACEHOLDER',
          },
        },
        web1: {
          security: {
            nonce: 'CSP_NONCE_PLACEHOLDER1',
          },
          output: {
            distPath: 'dist/dist1',
          },
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'dist/index.html');
  expect(html).toContain(`<script defer nonce="CSP_NONCE_PLACEHOLDER">`);
  expect(html).toContain(`<style nonce="CSP_NONCE_PLACEHOLDER">body{`);

  const html1 = getFileContent(files, 'dist1/index.html');
  expect(html1).toContain(`<script defer nonce="CSP_NONCE_PLACEHOLDER1">`);
  expect(html1).toContain(`<style nonce="CSP_NONCE_PLACEHOLDER1">body{`);
});

import { expect, test } from '@e2e/helper';
import type { ManifestData } from '@rsbuild/core';

// https://github.com/web-infra-dev/rsbuild/issues/6187
test('should generate manifest with initial chunks in correct order', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);
  const manifestContent = files[filenames.find((file) => file.endsWith('manifest.json'))!];
  const manifest: ManifestData = JSON.parse(manifestContent);

  for (const entry of Object.values(manifest.entries)) {
    const htmlFileName = entry.html![0];
    const html = files[filenames.find((file) => file.endsWith(htmlFileName))!];

    const scriptMatches = html.match(/<script[^>]*src="([^"]+)"/g) || [];
    const htmlScriptOrder = scriptMatches
      .map((match) => {
        const srcMatch = match.match(/src="([^"]+)"/);
        return srcMatch ? srcMatch[1] : '';
      })
      .filter(Boolean);

    const linkMatches = html.match(/<link[^>]*href="([^"]+)"[^>]*rel="stylesheet"/g) || [];
    const htmlCssOrder = linkMatches
      .map((match) => {
        const hrefMatch = match.match(/href="([^"]+)"/);
        return hrefMatch ? hrefMatch[1] : '';
      })
      .filter(Boolean);

    expect(entry.initial?.js).toEqual(htmlScriptOrder);
    expect(entry.initial?.css).toEqual(htmlCssOrder);
  }
});

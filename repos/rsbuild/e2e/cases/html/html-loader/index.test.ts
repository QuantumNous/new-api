import { expect, test } from '@e2e/helper';

test('should allow to use html-loader', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    const files = result.getDistFiles();
    const filenames = Object.keys(files);

    expect(
      filenames.some((filename) => filename.includes('dist/static/image/image.png')),
    ).toBeTruthy();

    const htmlFile = filenames.find((filename) => filename.endsWith('.html'));
    expect(files[htmlFile!]).toContain('<img src="/static/image/image.png"');
  });
});

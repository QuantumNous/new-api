import { expect, getFileContent, test } from '@e2e/helper';

type SassUrlResult = {
  styleContent: string;
  styleUrl: string;
  targetColor: string;
};

test('should return transformed Sass URL with `?url`', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const { styleContent, styleUrl, targetColor } = await page.evaluate<SassUrlResult>(
      'window.getSassUrlResult()',
    );

    expect(styleUrl).toMatch(/\/static\/css\/style\.css$/);
    expect(styleContent).toContain('.url-query-sass');
    expect(styleContent).toMatch(/\.url-query-sass:{1,2}after/);
    expect(targetColor).toBe('rgb(0, 0, 0)');

    if (mode === 'build') {
      const html = getFileContent(result.getDistFiles(), 'index.html');
      expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    }
  });
});

import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

type LessUrlResult = {
  styleContent: string;
  styleUrl: string;
  targetColor: string;
};

test('should return transformed Less URL with `?url`', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const { styleContent, styleUrl, targetColor } = await page.evaluate<LessUrlResult>(
      'window.getLessUrlResult()',
    );

    expect(styleUrl).toMatch(/\/static\/css\/style\.css$/);
    expect(styleContent).toContain('.url-query-less');
    expect(styleContent).toMatch(/\.url-query-less:{1,2}after/);
    expect(targetColor).toBe('rgb(0, 0, 0)');

    if (mode === 'build') {
      const html = getFileContent(result.getDistFiles(), 'index.html');
      expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    }
  });
});

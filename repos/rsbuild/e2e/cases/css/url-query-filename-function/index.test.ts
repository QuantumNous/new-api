import { expect, test } from '@e2e/helper';

type CssUrlResult = {
  styleUrl: string;
  styleContent: string;
};

test('should pass asset info to CSS URL filename function', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const { styleUrl, styleContent } = await page.evaluate<CssUrlResult>(
      'window.getCssUrlResult()',
    );

    expect(styleUrl).toMatch(/\/static\/css\/from-asset-info\/style\.css$/);
    expect(styleContent).toContain('.filename-function-class');
  });
});

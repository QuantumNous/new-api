import { expect, test } from '@e2e/helper';
import { findFile, getFileContent } from '@rstackjs/test-utils';

type CssUrlResult = {
  aStyleContent: string;
  aStyleUrl: string;
  bStyleContent: string;
  bStyleUrl: string;
  externalStyleContent: string;
  externalStyleUrl: string;
  styleUrl: string;
  styleContent: string;
  urlLeadingQueryContent: string;
  urlLeadingQueryUrl: string;
  urlTrailingQueryContent: string;
  urlTrailingQueryUrl: string;
  urlValueQueryContent: string;
  urlValueQueryUrl: string;
  targetColor: string;
};

test('should return transformed CSS URL with `?url`', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    const {
      aStyleContent,
      aStyleUrl,
      bStyleContent,
      bStyleUrl,
      externalStyleContent,
      externalStyleUrl,
      styleUrl,
      styleContent,
      urlLeadingQueryContent,
      urlLeadingQueryUrl,
      urlTrailingQueryContent,
      urlTrailingQueryUrl,
      urlValueQueryContent,
      urlValueQueryUrl,
      targetColor,
    } = await page.evaluate<CssUrlResult>('window.getCssUrlResult()');

    expect(styleUrl).toMatch(/\/static\/css\/style\.css$/);
    expect(styleContent).toContain('.url-query-class');
    expect(styleContent).toContain('--postcss-transformed');
    expect(aStyleUrl).toMatch(/\/static\/css\/a\/index\.css$/);
    expect(aStyleContent).toContain('.a-index');
    expect(bStyleUrl).toMatch(/\/static\/css\/b\/index\.css$/);
    expect(bStyleContent).toContain('.b-index');
    expect(aStyleUrl).not.toBe(bStyleUrl);
    expect(externalStyleUrl).toMatch(/\/static\/css\/shared\/external\.css$/);
    expect(externalStyleContent).toContain('.external-url-query');
    expect(urlLeadingQueryUrl).toMatch(/\/static\/css\/url-leading-query\.css$/);
    expect(urlLeadingQueryContent).toContain('.url-leading-query');
    expect(urlTrailingQueryUrl).toMatch(/\/static\/css\/url-trailing-query\.css$/);
    expect(urlTrailingQueryContent).toContain('.url-trailing-query');
    expect(urlValueQueryUrl).toMatch(/\/static\/css\/url-value-query\.css$/);
    expect(urlValueQueryContent).toContain('.url-value-query');
    expect(targetColor).toBe('rgb(0, 0, 0)');

    if (mode === 'build') {
      const html = getFileContent(result.getDistFiles(), 'index.html');
      expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    }
  });
});

test('should emit hashed CSS files for `?url` in production', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        filenameHash: true,
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const styleFile = findFile(files, /style\.[a-f0-9]+\.css$/, {
    ignoreHash: false,
  });
  const jsContent = getFileContent(files, 'index.js');
  expect(files[styleFile]).toContain('.url-query-class');
  expect(jsContent).toMatch(/static\/css\/style\.[a-f0-9]+\.css/);
});

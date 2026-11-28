import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

const utf8Str = `你好 world! I'm 🦀`;
const asciiStr = `\\u{4F60}\\u{597D} world! I'm \\u{1F980}`;
const expectedObject = {
  Å: 'A',
  Ð: 'D',
  Þ: 'o',
  å: 'a',
  ð: 'd',
  þ: 'o',
  Д: 'A',
  𝒩: 'a',
};

test('should set output.charset to ascii', async ({ page, runBothServe }) => {
  await runBothServe(
    async ({ mode, result }) => {
      expect(await page.evaluate('window.testA')).toBe(utf8Str);
      expect(await page.evaluate('window.testB')).toStrictEqual(expectedObject);

      if (mode === 'dev') {
        const files = result.getDistFiles();
        const content = getFileContent(
          files,
          (name) => name.endsWith('.js') && name.includes('static/js/index'),
        );
        expect(content.includes(asciiStr)).toBeTruthy();
      } else {
        const content = await result.getIndexBundle();
        expect(content.includes(`\\u4F60\\u597D world! I'm \\u{1F980}`)).toBeTruthy();
      }
    },
    {
      config: {
        output: {
          charset: 'ascii',
        },
      },
    },
  );
});

test('should use utf8 charset by default', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode, result }) => {
    expect(await page.evaluate('window.testA')).toBe(utf8Str);
    expect(await page.evaluate('window.testB')).toStrictEqual(expectedObject);

    if (mode === 'dev') {
      const files = result.getDistFiles();
      const content = getFileContent(
        files,
        (name) => name.endsWith('.js') && name.includes('static/js/index'),
      );
      expect(content.includes(utf8Str)).toBeTruthy();
    } else {
      const content = await result.getIndexBundle();
      expect(content.includes(utf8Str)).toBeTruthy();
    }
  });
});

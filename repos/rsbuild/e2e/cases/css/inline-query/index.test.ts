import { expect, test } from '@e2e/helper';

test('should allow to import inline CSS files', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode }) => {
    for (const key of ['aInline1', 'aInline2', 'aInline3', 'aInline4']) {
      const inline: string = await page.evaluate(`window.${key}`);
      if (mode === 'dev') {
        expect(inline.includes('.header-class') && inline.includes('color: red')).toBe(true);
      } else {
        expect(inline.includes('.header-class{color:red}')).toBe(true);
      }
    }

    const bStyles: Record<string, string> = await page.evaluate('window.bStyles');

    if (mode === 'dev') {
      const bInline: string = await page.evaluate('window.bInline');
      expect(bInline.includes('.title-class') && bInline.includes('font-size: 14px')).toBe(true);
    } else {
      expect(await page.evaluate('window.bInline')).toBe('.title-class{font-size:14px}');
    }

    expect(bStyles['title-class']).toBeTruthy();
  });
});

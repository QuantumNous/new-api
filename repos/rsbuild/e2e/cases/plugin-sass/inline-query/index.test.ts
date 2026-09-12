import { expect, test } from '@e2e/helper';

test('should allow to import inline Sass files', async ({ page, runBothServe }) => {
  await runBothServe(async ({ mode }) => {
    const aInline: string = await page.evaluate('window.aInline');
    const bInline: string = await page.evaluate('window.bInline');
    const bStyles: Record<string, string> = await page.evaluate('window.bStyles');

    if (mode === 'dev') {
      expect(aInline.includes('.header-class') && aInline.includes('color: red')).toBe(true);
      expect(bInline.includes('.title-class') && bInline.includes('font-size: 14px')).toBe(true);
    } else {
      expect(aInline).toBe('.header-class{color:red}');
      expect(bInline).toBe('.title-class{font-size:14px}');
    }

    expect(bStyles['title-class']).toBeTruthy();
  });
});

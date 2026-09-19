import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('should support importing raw Less files', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const aRaw: string = await page.evaluate('window.aRaw');
    const bRaw: string = await page.evaluate('window.bRaw');
    const bStyles: Record<string, string> = await page.evaluate('window.bStyles');

    expect(aRaw).toBe(readFileSync(path.join(import.meta.dirname, 'src/a.less'), 'utf-8'));
    expect(bRaw).toBe(readFileSync(path.join(import.meta.dirname, 'src/b.module.less'), 'utf-8'));
    expect(bStyles['title-class']).toBeTruthy();
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('HMR should work properly', async ({ page, dev, editFile }) => {
  const cwd = import.meta.dirname;
  const bPath = path.join(cwd, 'src/test-temp-B.svelte');
  fs.writeFileSync(bPath, fs.readFileSync(path.join(cwd, 'src/B.svelte'), 'utf-8'));

  await dev();

  const a = page.locator('#A');
  const b = page.locator('#B');

  await expect(a).toHaveText('A: 0');
  await expect(b).toHaveText('B: 0');

  await a.click({ clickCount: 5 });
  await expect(a).toHaveText('A: 5');
  await expect(b).toHaveText('B: 5');

  // simulate a change to component B's source code
  const sourceCodeB = fs.readFileSync(bPath, 'utf-8');
  await editFile(bPath, (code) => code.replace('B:', 'Beep:'));

  // content of B changed to `Beep: 0` means HMR has taken effect
  await expect(b).toHaveText('Beep: 0');
  // the state (count) of A is not kept because `svelte-loader` does not support HMR for Svelte 5 yet
  await expect(a).toHaveText('A: 0');

  await editFile(bPath, () => sourceCodeB); // recover the source code
});

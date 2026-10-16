import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('HMR should work properly', async ({ page, dev, editFile }) => {
  const root = import.meta.dirname;
  const compFilePath = path.join(root, 'src/test-temp-B.jsx');
  const compSourceCode = `const B = (props) => {
  return <div id="B">B: {props.count}</div>;
};

export default B;
`;

  fs.writeFileSync(compFilePath, compSourceCode, 'utf-8');

  await dev();

  const a = page.locator('#A');
  const b = page.locator('#B');

  await expect(a).toHaveText('A: 0');
  await expect(b).toHaveText('B: 0');

  await a.click({ clickCount: 5 });
  await expect(a).toHaveText('A: 5');
  await expect(b).toHaveText('B: 5');

  // simulate a change to component B's source code
  await editFile(compFilePath, (code) => code.replace('B:', 'Beep:'));

  await page.waitForFunction(() => {
    const aText = document.querySelector('#A')?.textContent;
    const bText = document.querySelector('#B')?.textContent;

    return (
      // the state (count) of A should not be kept
      aText === 'A: 0' &&
      // content of B changed to `Beep: 0` means HMR has taken effect
      bText === 'Beep: 0'
    );
  });
});

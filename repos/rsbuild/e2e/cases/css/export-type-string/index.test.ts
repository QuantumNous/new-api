import { expect, test } from '@e2e/helper';

test('should allow to configure `cssLoader.exportType` as `string`', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async ({ mode }) => {
    expect(await page.evaluate('window.a')).toBe(`.the-a-class {
  color: red;
}

.the-a-class .child-class {
  color: #00f;
}
`);

    if (mode === 'dev') {
      expect(
        (await page.evaluate<string>('window.b')).includes('.src-b-module__the-b-class'),
      ).toBeTruthy();
    } else {
      expect((await page.evaluate<string>('window.b')).includes('.the-b-class-')).toBeTruthy();
    }
  });
});

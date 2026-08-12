import { expect, getFileContent, test } from '@e2e/helper';

test('should add vendor prefixes by current browserslist', async ({ runBoth }) => {
  await runBoth(async ({ mode, result }) => {
    const files = result.getDistFiles();

    if (mode === 'build') {
      const content = getFileContent(files, '.css');
      expect(content).toEqual(
        '@media (-webkit-min-device-pixel-ratio:2),(min-resolution:2dppx){.item{-webkit-user-select:none;-ms-user-select:none;user-select:none;background:-webkit-linear-gradient(#000,#fff);background:linear-gradient(#fff,#000);-webkit-transition:all .5s;transition:all .5s}}',
      );
    } else {
      const content = getFileContent(files, 'css/index.css');
      expect(content).toContain(
        `@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
  .item {
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
    background: -webkit-linear-gradient(top, #fff, #000);
    background: linear-gradient(#fff, #000);
    -webkit-transition: all .5s;
    transition: all .5s;
  }
}`,
      );
    }
  });
});

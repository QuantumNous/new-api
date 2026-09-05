import { expect, gotoPage, test } from '@e2e/helper';

const BUILD_PAGE1 = 'building src/page1/index.js';
const BUILD_PAGE2 = 'building src/page2/index.js';

test('should render pages correctly when using lazy compilation', async ({ page, dev }) => {
  const rsbuild = await dev({
    config: {
      dev: {
        lazyCompilation: true,
      },
    },
  });

  // initial build
  await rsbuild.expectBuildEnd();
  rsbuild.clearLogs();

  // build page1
  await gotoPage(page, rsbuild, 'page1');
  await rsbuild.expectLog(BUILD_PAGE1, { posix: true });
  await rsbuild.expectBuildEnd();
  await expect(page.locator('#test')).toHaveText('Page 1');
  rsbuild.expectNoLog(BUILD_PAGE2, { posix: true });
  rsbuild.clearLogs();

  // build page2
  await gotoPage(page, rsbuild, 'page2');
  await rsbuild.expectLog(BUILD_PAGE2, { posix: true });
  await rsbuild.expectBuildEnd();
  await expect(page.locator('#test')).toHaveText('Page 2');
});

test('should allow to configure `tools.rspack.lazyCompilation`', async ({ page, dev }) => {
  const rsbuild = await dev({
    config: {
      tools: {
        rspack: {
          lazyCompilation: true,
        },
      },
    },
  });

  // initial build
  await rsbuild.expectBuildEnd();
  rsbuild.clearLogs();

  // build page1
  await gotoPage(page, rsbuild, 'page1');
  await rsbuild.expectLog(BUILD_PAGE1, { posix: true });
  await rsbuild.expectBuildEnd();
  await expect(page.locator('#test')).toHaveText('Page 1');
  rsbuild.expectNoLog(BUILD_PAGE2, { posix: true });
  rsbuild.clearLogs();

  // build page2
  await gotoPage(page, rsbuild, 'page2');
  await rsbuild.expectLog(BUILD_PAGE2, { posix: true });
  await rsbuild.expectBuildEnd();
  await expect(page.locator('#test')).toHaveText('Page 2');
});

import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

const buildAndRead = async (build: any) => {
  const rsbuild = await build();

  const mainContent = await fs.promises.readFile(join(rsbuild.distPath, 'main.html'), 'utf-8');
  const fooContent = await fs.promises.readFile(join(rsbuild.distPath, 'foo.html'), 'utf-8');

  return { rsbuild, mainContent, fooContent };
};

test.describe('should combine multiple html config correctly', () => {
  test('should inject Apple touch icons', async ({ build }) => {
    const { rsbuild, mainContent, fooContent } = await buildAndRead(build);

    const [, iconRelativePath] =
      /<link rel="apple-touch-icon" sizes="180x180" href="(.*?)">/.exec(mainContent) || [];

    expect(iconRelativePath).toBeDefined();

    const iconPath = join(rsbuild.distPath, iconRelativePath);
    expect(fs.existsSync(iconPath)).toBeTruthy();

    expect(/<link.*rel="apple-touch-icon".*href="(.*?)">/.test(fooContent)).toBeTruthy();
  });

  test('should inject favicon links', async ({ build }) => {
    const { rsbuild, mainContent, fooContent } = await buildAndRead(build);

    const [, iconRelativePath] = /<link.*rel="icon".*href="(.*?)">/.exec(mainContent) || [];

    expect(iconRelativePath).toBeDefined();

    const iconPath = join(rsbuild.distPath, iconRelativePath);
    expect(fs.existsSync(iconPath)).toBeTruthy();

    expect(/<link.*rel="icon".*href="(.*?)">/.test(fooContent)).toBeTruthy();
  });

  test('should inject scripts into the body when configured', async ({ build }) => {
    const { mainContent } = await buildAndRead(build);
    expect(/<head>[\s\S]*<script[\s\S]*>[\s\S]*<\/head>/.test(mainContent)).toBeFalsy();
    expect(/<body>[\s\S]*<script[\s\S]*>[\s\S]*<\/body>/.test(mainContent)).toBeTruthy();
  });

  test('should inject custom meta tags', async ({ build }) => {
    const { mainContent } = await buildAndRead(build);
    expect(
      /<meta name="description" content="a description of the page">/.test(mainContent),
    ).toBeTruthy();
  });
});

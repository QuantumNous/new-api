import { expect, getFileContent, test } from '@e2e/helper';

test('should auto externalize dependencies for web CommonJS library output', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web',
        autoExternal: true,
      },
      tools: {
        rspack: {
          output: {
            library: {
              type: 'commonjs2',
            },
          },
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('require("@e2e/auto-external-pkg")');
  expect(content).toContain('require("@e2e/auto-external-pkg/subpath")');
  expect(content).toContain('require("@e2e/auto-external-peer-pkg")');
  expect(content).not.toContain('require("@e2e/auto-external-dev-pkg")');
});

test('should auto externalize dependencies for web ESM output', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'web',
        module: true,
        autoExternal: true,
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toMatch(/import(?:[^;]*from)?"@e2e\/auto-external-pkg"/);
  expect(content).toMatch(/import(?:[^;]*from)?"@e2e\/auto-external-pkg\/subpath"/);
  expect(content).toMatch(/import(?:[^;]*from)?"@e2e\/auto-external-peer-pkg"/);
  expect(content).not.toContain('@e2e/auto-external-dev-pkg');
});

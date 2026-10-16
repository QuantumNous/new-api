import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

const expectBundledExport = (content: string, exportName: 'dep' | 'dev' | 'peer') => {
  expect(content).toContain(JSON.stringify(exportName));
};

const expectBundledSubpath = (content: string) => {
  expect(content).toContain("const subpath = 'subpath';");
};

test('should not auto externalize package.json dependencies by default', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expectBundledExport(content, 'dep');
  expectBundledSubpath(content);
  expectBundledExport(content, 'dev');
  expectBundledExport(content, 'peer');
  expect(content).not.toContain('external "@e2e/auto-external-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).not.toContain('external "@e2e/auto-external-peer-pkg"');
});

test('should auto externalize dependencies and subpath imports', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: true,
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-pkg"');
  expect(content).toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).toContain('external "@e2e/auto-external-peer-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-dev-pkg"');
  expectBundledExport(content, 'dev');
});

test('should allow output.externals to override autoExternal rules', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: true,
        externals: {
          '@e2e/auto-external-pkg': '@e2e/auto-external-overridden-pkg',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-overridden-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg"');
  expectBundledSubpath(content);
  expect(content).toContain('external "@e2e/auto-external-peer-pkg"');
});

test('should auto externalize devDependencies when enabled', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          devDependencies: true,
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-dev-pkg"');
});

test('should auto externalize dependencies from custom packageJson path', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          packageJson: '../auto-external-fixtures/package-json-dev.json',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-dev-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).not.toContain('external "@e2e/auto-external-peer-pkg"');
  expectBundledExport(content, 'dep');
  expectBundledSubpath(content);
  expectBundledExport(content, 'peer');
});

test('should auto externalize dependencies from multiple packageJson paths', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          packageJson: [
            '../auto-external-fixtures/package-json-dep.json',
            '../auto-external-fixtures/package-json-peer.json',
          ],
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-pkg"');
  expect(content).toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).toContain('external "@e2e/auto-external-peer-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-dev-pkg"');
  expectBundledExport(content, 'dev');
});

test('should not auto externalize packages matched by string exclude', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          exclude: '@e2e/auto-external-pkg',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expectBundledExport(content, 'dep');
  expectBundledSubpath(content);
  expect(content).not.toContain('external "@e2e/auto-external-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).toContain('external "@e2e/auto-external-peer-pkg"');
});

test('should not auto externalize packages matched by regexp exclude', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          exclude: /^@e2e\/auto-external-peer-pkg$/,
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('external "@e2e/auto-external-pkg"');
  expect(content).toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).not.toContain('external "@e2e/auto-external-peer-pkg"');
  expectBundledExport(content, 'peer');
});

test('should not auto externalize packages matched by mixed exclude', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
        autoExternal: {
          exclude: ['@e2e/auto-external-pkg', /^@e2e\/auto-external-peer-pkg$/],
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).not.toContain('external "@e2e/auto-external-pkg"');
  expect(content).not.toContain('external "@e2e/auto-external-pkg/subpath"');
  expect(content).not.toContain('external "@e2e/auto-external-peer-pkg"');
  expectBundledExport(content, 'dep');
  expectBundledSubpath(content);
  expectBundledExport(content, 'peer');
});

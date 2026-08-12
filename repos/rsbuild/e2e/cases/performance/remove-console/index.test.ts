import type { BuildResult } from '@e2e/helper';
import { expect, getFileContent, test } from '@e2e/helper';

const expectConsoleType = async (
  rsbuild: Awaited<BuildResult>,
  consoleType: Record<string, boolean>,
) => {
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.js');

  for (const [key, value] of Object.entries(consoleType)) {
    expect(content.includes(`test-console-${key}`)).toEqual(value);
  }
};

test('should remove specified console correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        removeConsole: ['log', 'warn'],
      },
    },
  });

  await expectConsoleType(rsbuild, {
    log: false,
    warn: false,
    debug: true,
    error: true,
  });
});

test('should remove all console correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      performance: {
        removeConsole: true,
      },
    },
  });

  await expectConsoleType(rsbuild, {
    log: false,
    warn: false,
    debug: false,
    error: false,
  });

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.js');

  expect(content).not.toContain('test-console-side-effect');
  expect(content).toContain('side-effect-preserved');
});

import { expect, test } from '@e2e/helper';

test('should skip Tailwind main-rule transform when CSS is not emitted', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        target: 'node',
      },
    },
  });

  const files = rsbuild.getDistFiles();
  expect(Object.keys(files).some((file) => file.endsWith('.css'))).toBe(false);
});

test('should run Tailwind main-rule transform when emitCss is enabled', async ({ build }) => {
  const rsbuild = await build({
    catchBuildError: true,
    config: {
      output: {
        emitCss: true,
        target: 'node',
      },
    },
  });

  expect(rsbuild.buildError?.message).toBe('Rspack build failed.');
  await rsbuild.expectLog('missing-tailwind-plugin');
});

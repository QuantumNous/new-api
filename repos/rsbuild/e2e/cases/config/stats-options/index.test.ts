import { test } from '@e2e/helper';

const WARNING_MSG = 'Using / for division outside of calc() is deprecated';

test('should log warning by default', async ({ build }) => {
  const rsbuild = await build();

  await rsbuild.expectLog(WARNING_MSG);
});

test('should not log warning when set stats.warnings false', async ({ build }) => {
  const rsbuild = await build({
    config: {
      tools: {
        bundlerChain: (chain) => {
          chain.stats({
            warnings: false,
          });
        },
      },
    },
  });

  rsbuild.expectNoLog(WARNING_MSG);
});

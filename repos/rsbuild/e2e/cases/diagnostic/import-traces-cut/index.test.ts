import { expect, test } from '@e2e/helper';

const EXPECTED_LOG = `Import traces (entry → error):
  ./src/index.js
  ./src/child1.js
  ... (3 hidden)
  ./src/child5.js
  ./src/child6.js ×`;

test('should truncate long import trace and show hidden count', async ({ runBoth }) => {
  await runBoth(
    async ({ mode, result }) => {
      if (mode === 'build') {
        expect(result.buildError).toBeTruthy();
      }
      await result.expectLog(EXPECTED_LOG);
    },
    { catchBuildError: true },
  );
});

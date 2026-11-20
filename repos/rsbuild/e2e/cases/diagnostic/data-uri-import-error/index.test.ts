import { expect, test } from '@e2e/helper';

const EXPECTED_LOG = `File: data-uri virtual module (import "un-existing-module")`;

test('should print data-uri virtual module error if module build failed', async ({ runBoth }) => {
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

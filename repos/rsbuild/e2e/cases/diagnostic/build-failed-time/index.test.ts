import { test } from '@e2e/helper';

const EXPECTED_LOG = /build failed in (?:[\d.]+s|\d+m(?: [\d.]+s)?)/;

test('should print build failed time', async ({ runBoth }) => {
  await runBoth(
    async ({ result }) => {
      await result.expectLog(EXPECTED_LOG);
    },
    { catchBuildError: true },
  );
});

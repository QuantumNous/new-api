import { test } from '@e2e/helper';

const EXPECTED_LOG = /built in (?:[\d.]+s|\d+m(?: [\d.]+s)?)/;

test('should print build time', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    await result.expectLog(EXPECTED_LOG);
  });
});

import { test } from '@e2e/helper';

const EXPECTED_FILE = /File: \.\/src\/App\.vue\.js\?vue&type=script&lang=js:1:1-\d+/;
const EXPECTED_ERROR = `× ESModulesLinkingError: export 'default' (reexported as 'default') was not found`;

test('should display Vue compilation error', async ({ runBoth }) => {
  await runBoth(
    async ({ result }) => {
      await result.expectLog(EXPECTED_FILE, { strict: true });
      await result.expectLog(EXPECTED_ERROR);
    },
    { catchBuildError: true },
  );
});

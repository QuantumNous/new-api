import { expect, test } from '@e2e/helper';

const EXPECTED_LOG = `Import traces (entry → error):
  ./src/index.js
  ./src/App.vue
  ./src/App.vue.css?vue&type=style`;

test('should print Vue SFC import traces', async ({ runBoth }) => {
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

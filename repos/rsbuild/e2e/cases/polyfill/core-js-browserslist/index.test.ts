import { expect, test } from '@e2e/helper';
import { getPolyfillContent } from '../helper';

test('should read browserslist correctly', async ({ runBoth }) => {
  await runBoth(async ({ mode, result }) => {
    const files = result.getDistFiles({ sourceMaps: true });
    const content = getPolyfillContent(files);

    if (mode === 'dev') {
      expect(content.includes('es.string.replace-all')).toBeFalsy();
    } else {
      expect(content.includes('es.string.replace-all')).toBeTruthy();
    }
  });
});

import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should configure jsc.target correctly', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    const files = result.getDistFiles();
    const content = getFileContent(files, 'index.js');
    expect(content).not.toContain('...baz');
  });
});

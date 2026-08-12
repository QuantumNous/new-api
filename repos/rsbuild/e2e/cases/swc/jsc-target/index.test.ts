import { expect, getFileContent, test } from '@e2e/helper';

test('should configure jsc.target correctly', async ({ runBoth }) => {
  await runBoth(async ({ result }) => {
    const files = result.getDistFiles();
    const content = getFileContent(files, 'index.js');
    expect(content).not.toContain('...baz');
  });
});

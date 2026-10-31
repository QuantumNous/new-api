import { expect, test } from '@e2e/helper';

test('should exit with error code 1 when unknown options are provided', async ({ execCliSync }) => {
  try {
    execCliSync('build --unknown-option', {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    throw new Error('execCliSync was expected to throw but did not.');
  } catch (err: any) {
    expect(err.status).toBe(1);
    expect(err.stderr.toString()).toContain('Unknown option `--unknownOption`');
  }
});

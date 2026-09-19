import { test } from '@e2e/helper';

test('should print help message if undefined process.env.* is accessed in dev', async ({ dev }) => {
  const rsbuild = await dev();
  await rsbuild.expectLog(
    'To access `process.env.*`, define them in a `.env` file with the `PUBLIC_` prefix.',
  );
});

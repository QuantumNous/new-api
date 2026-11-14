import { expect, test } from '@e2e/helper';

test('should disable compression when server.compress is false', async ({
  request,
  runBothServe,
}) => {
  await runBothServe(async ({ result }) => {
    const asyncJsResponse = await request.get(
      `http://localhost:${result.port}/static/js/async/react-dom.js`,
    );
    expect(asyncJsResponse.headers()['content-encoding']).toEqual(undefined);
  });
});

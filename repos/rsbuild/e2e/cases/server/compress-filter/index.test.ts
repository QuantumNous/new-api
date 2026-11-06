import { expect, test } from '@e2e/helper';

test('should support configuring the compression filter in dev', async ({ request, dev }) => {
  const rsbuild = await dev();

  const indexJsResponse = await request.get(`http://localhost:${rsbuild.port}/static/js/index.js`);
  expect(indexJsResponse.headers()['content-encoding']).toEqual(undefined);

  const asyncJsResponse = await request.get(
    `http://localhost:${rsbuild.port}/static/js/async/react-dom.js`,
  );
  expect(asyncJsResponse.headers()['content-encoding']).toEqual('gzip');
});

test('should support configuring the compression filter in preview mode', async ({
  request,
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const indexJsResponse = await request.get(`http://localhost:${rsbuild.port}/static/js/index.js`);
  expect(indexJsResponse.headers()['content-encoding']).toEqual(undefined);

  const asyncJsResponse = await request.get(
    `http://localhost:${rsbuild.port}/static/js/async/react-dom.js`,
  );
  expect(asyncJsResponse.headers()['content-encoding']).toEqual('gzip');
});

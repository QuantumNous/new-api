import { expect, test } from '@e2e/helper';

test('should apply server.headers to served responses', async ({ request, runBothServe }) => {
  await runBothServe(async ({ result }) => {
    const response = await request.get(`http://localhost:${result.port}/`);
    expect(response.headers()['x-rsbuild-test']).toBe('server-headers');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  });
});

test('should apply array values in server.headers', async ({ request, runBothServe }) => {
  await runBothServe(
    async ({ result }) => {
      const response = await request.get(`http://localhost:${result.port}/`);
      expect(response.headers()['x-rsbuild-list'].split(/,\s*/)).toEqual(['one', 'two']);
    },
    {
      config: {
        server: {
          headers: {
            'x-rsbuild-list': ['one', 'two'],
          },
        },
      },
    },
  );
});

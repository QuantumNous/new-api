import { expect, test } from '@e2e/helper';

test('should not gzip SSE responses after internal middleware', async ({
  request,
  runBothServe,
}) => {
  await runBothServe(
    async ({ result }) => {
      const response = await request.get(`http://localhost:${result.port}/api/sse`, {
        headers: {
          'accept-encoding': 'gzip',
        },
      });
      const headers = response.headers();
      const text = (await response.body()).toString('utf8');

      expect(headers['content-encoding']).toEqual(undefined);
      expect(headers['content-type']).toContain('text/event-stream');
      expect(text).toContain('Hello SSE1');
      expect(text).toContain('Hello SSE2');
    },
    {
      config: {
        server: {
          historyApiFallback: false,
          htmlFallback: false,
          setup: ({ server }) => {
            return () => {
              server.middlewares.use((req, res, next) => {
                if (req.url === '/api/sse') {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                  });
                  res.end('data: Hello SSE1\n\ndata: Hello SSE2\n\n');
                  return;
                }
                next();
              });
            };
          },
        },
      },
    },
  );
});

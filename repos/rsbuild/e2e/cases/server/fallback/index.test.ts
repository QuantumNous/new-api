import { expect, test } from '@e2e/helper';

test('should return 204 for OPTIONS requests when no middleware handles them', async ({ dev }) => {
  const rsbuild = await dev();
  const response = await fetch(`http://localhost:${rsbuild.port}`, {
    headers: {
      'content-type': 'application/json',
    },
    method: 'OPTIONS',
  });
  expect(response.status).toBe(204);
});

test('should return 200 with custom headers for OPTIONS requests handled by middleware', async ({
  dev,
}) => {
  const rsbuild = await dev({
    config: {
      server: {
        cors: false,
        setup: ({ server }) => {
          server.middlewares.use((req, res, next) => {
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.setHeader('access-control-allow-origin', 'https://example.com');
              res.end();
              return;
            }
            next();
          });
        },
      },
    },
  });

  const response = await fetch(`http://localhost:${rsbuild.port}`, {
    headers: {
      'content-type': 'application/json',
    },
    method: 'OPTIONS',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
});

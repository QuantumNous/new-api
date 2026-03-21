import http from 'node:http';

export type DockerHubStubResponse = {
  results: Array<{ name: string; last_updated: string }>;
  next?: string | null;
};

export async function withDockerHubStub(
  port: number,
  response: DockerHubStubResponse,
  run: () => Promise<void>,
): Promise<void> {
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/v2/namespaces/playwright/repositories/new-api/tags')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  try {
    await run();
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

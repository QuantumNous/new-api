import { createServer, type Server } from 'node:http';
import { expect, gotoPage, test } from '@e2e/helper';
import { getRandomPort } from '@rstackjs/test-utils';

const listen = (server: Server, port: number) =>
  new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, 'localhost', () => {
      server.off('error', reject);
      resolve();
    });
  });

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

test('should use dev.client URL for lazy compilation trigger requests', async ({
  page,
  devOnly,
}) => {
  const rsbuildPort = await getRandomPort();
  const backendPort = await getRandomPort();
  const lazyTriggerRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/_rspack/lazy/trigger')) {
      lazyTriggerRequests.push(request.url());
    }
  });

  const rsbuild = await devOnly({
    config: {
      server: {
        port: rsbuildPort,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
      dev: {
        assetPrefix: `http://localhost:${rsbuildPort}`,
        client: {
          port: rsbuildPort,
        },
      },
    },
  });

  const htmlResponse = await fetch(`http://localhost:${rsbuild.port}/index.html`);
  expect(htmlResponse.ok).toBeTruthy();

  const html = await htmlResponse.text();
  const backendServer = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  });

  await listen(backendServer, backendPort);

  try {
    await page.goto(`http://localhost:${backendPort}`);
    await expect(page.locator('#result')).toHaveText('initial');

    await page.locator('#load').click();
    await rsbuild.expectLog('building src/lazy.js', { posix: true });
    await rsbuild.expectBuildEnd();

    await expect(page.locator('#result')).toHaveText('lazy loaded');
    expect(lazyTriggerRequests).toContain(`http://localhost:${rsbuildPort}/_rspack/lazy/trigger`);
  } finally {
    await close(backendServer);
  }
});

test('should prefer lazyCompilation.serverUrl over dev.client URL', async ({ page, devOnly }) => {
  const wrongClientPort = await getRandomPort();
  const lazyTriggerRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/_rspack/lazy/trigger')) {
      lazyTriggerRequests.push(request.url());
    }
  });

  const rsbuild = await devOnly({
    config: {
      dev: {
        client: {
          port: wrongClientPort,
        },
        lazyCompilation: {
          imports: true,
          entries: false,
          serverUrl: 'http://localhost:<port>',
        },
      },
    },
  });

  await gotoPage(page, rsbuild);
  await expect(page.locator('#result')).toHaveText('initial');

  await page.locator('#load').click();
  await rsbuild.expectLog('building src/lazy.js', { posix: true });
  await rsbuild.expectBuildEnd();

  await expect(page.locator('#result')).toHaveText('lazy loaded');
  expect(lazyTriggerRequests).toContain(`http://localhost:${rsbuild.port}/_rspack/lazy/trigger`);
});

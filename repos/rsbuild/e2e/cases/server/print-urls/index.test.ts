import { expect, NETWORK_LOG_REGEX, test } from '@e2e/helper';

test('should print server urls correctly by default', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        htmlFallback: false,
      },
    },
  });

  const url = `http://localhost:${rsbuild.port}/`;
  await page.goto(url);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await rsbuild.expectLog(`➜  Local:    ${url}`);
  await rsbuild.expectLog('➜  Network:  use --host to expose');
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);

  expect(rsbuild.logs.find((log) => log.includes('/./'))).toBeFalsy();
});

test('should not print server urls when printUrls is false', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        printUrls: false,
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);

  rsbuild.expectNoLog(`➜  Local:    http://localhost:${rsbuild.port}`);
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);
});

test('should allow to custom urls', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        printUrls: ({ urls, protocol, port }) => {
          expect(typeof port).toEqual('number');
          expect(protocol).toEqual('http');
          expect(urls.includes(`http://localhost:${port}`)).toBeTruthy();
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);

  rsbuild.expectNoLog(`➜  Local:    http://localhost:${rsbuild.port}`);
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);
});

test('should allow to modify and return new urls', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        host: '0.0.0.0',
        printUrls: ({ urls }) => urls.map((url) => `${url}/test`),
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);

  await rsbuild.expectLog(`➜  Local:    http://localhost:${rsbuild.port}/test/`);
  await rsbuild.expectLog(/➜\s{2}Network:\s{2}http:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d+\/test\//);
});

test('should allow to modify and return new urls and labels', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        printUrls: ({ urls, port }) => {
          expect(urls.includes(`http://localhost:${port}`)).toBeTruthy();
          return urls
            .map<{ url: string; label?: string }>((url) => ({
              url,
              label: 'Custom:',
            }))
            .concat({ url: 'http://example.com/mcp', label: 'MCP:' })
            .concat({ url: 'http://localhost:8000/another-mcp' });
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);

  await rsbuild.expectLog(`➜  Custom:   http://localhost:${rsbuild.port}/`);
  await rsbuild.expectLog(`➜  MCP:      http://example.com/mcp/`);
  await rsbuild.expectLog(`➜  Local:    http://localhost:8000/another-mcp/`);
  rsbuild.expectNoLog(`➜  Local:    http://localhost:${rsbuild.port}`);
});

test('should listen only on localhost in dev', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        host: 'localhost',
        htmlFallback: false,
      },
    },
  });

  const url = `http://localhost:${rsbuild.port}/`;
  await page.goto(url);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await rsbuild.expectLog(`➜  Local:    ${url}`);
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);
});

test('should listen only on localhost in preview', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      server: {
        host: 'localhost',
        htmlFallback: false,
      },
    },
  });

  const url = `http://localhost:${rsbuild.port}/`;
  await page.goto(url);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await rsbuild.expectLog(`➜  Local:    ${url}`);
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);
});

test('should not print server urls when HTML is disabled', async ({ buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      tools: {
        htmlPlugin: false,
      },
    },
  });

  rsbuild.expectNoLog(`➜  Local:    http://localhost:${rsbuild.port}`);
  rsbuild.expectNoLog(NETWORK_LOG_REGEX);
});

test('should print server urls when HTML is disabled but printUrls is a custom function', async ({
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      tools: {
        htmlPlugin: false,
      },
      server: {
        printUrls: ({ port }) => [`http://localhost:${port}`],
      },
    },
  });

  await rsbuild.expectLog(`➜  Local:    http://localhost:${rsbuild.port}`);
});

test('should print server urls for multiple web environments with custom distPath.root', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        printUrls: ({ urls, routes }) => {
          expect(routes[0].pathname).toBe('/dist/');
          expect(routes[1].pathname).toBe('/.dist/web1/index1');
          return urls;
        },
      },
      environments: {
        web: {},
        web1: {
          source: {
            entry: {
              index1: './src/index.js',
            },
          },
          output: {
            distPath: '.dist/web1',
          },
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);

  await rsbuild.expectLog(`➜  Local:`);
  await rsbuild.expectLog(`-  index     http://localhost:${rsbuild.port}/dist/`);
  await rsbuild.expectLog(`-  index1    http://localhost:${rsbuild.port}/.dist/web1/index1`);
});

test('should print server urls for multiple web environments with custom distPath.html', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        htmlFallback: false,
      },
      environments: {
        web: {
          output: {
            distPath: {
              html: 'html0',
            },
          },
        },
        web1: {
          source: {
            entry: {
              main: './src/index.js',
            },
          },
          html: {
            outputStructure: 'nested',
          },
          output: {
            distPath: {
              html: 'html1',
            },
          },
        },
      },
    },
  });

  const url1 = `http://localhost:${rsbuild.port}/html0/`;
  const url2 = `http://localhost:${rsbuild.port}/html1/main`;

  await page.goto(url1);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await page.goto(url2);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await rsbuild.expectLog(`-  index    ${url1}`);
  await rsbuild.expectLog(`-  main     ${url2}`);
});

test('should print server urls for web and node environments with custom distPath.root', async ({
  page,
  devOnly,
}) => {
  const rsbuild = await devOnly({
    config: {
      server: {
        htmlFallback: false,
      },
      environments: {
        web: {
          output: {
            distPath: 'dist/client',
          },
        },
        node: {
          output: {
            target: 'node',
            distPath: './dist/server',
          },
        },
      },
    },
  });

  await page.goto(`http://localhost:${rsbuild.port}`);
  expect(await page.evaluate(() => window.test)).toBe(1);

  await rsbuild.expectLog(`➜  Local:    http://localhost:${rsbuild.port}/`, {
    strict: true,
  });
});

import { rspack } from '@rspack/core';
import { defaultAllowedOrigins } from '../src/defaultConfig';
import { isClientCompiler } from '../src/server/assets-middleware';
import {
  formatRoutes,
  isUrlPathUnderBase,
  joinUrlPath,
  printServerURLs,
  removeBasePath,
} from '../src/server/helper';
import { createHttpServer } from '../src/server/httpServer';
import type { Connect } from '../src/types';
import { logger } from '../src';

beforeEach(() => {
  const consoleLogSpy = rstest.spyOn(console, 'log');
  consoleLogSpy.mockImplementation(() => {});
});

test('should format routes correctly', () => {
  expect(
    formatRoutes(
      {
        index: 'src/index.ts',
        foo: 'src/index.ts',
        bar: 'src/index.ts',
      },
      '/',
      undefined,
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/',
    },
    {
      entryName: 'foo',
      pathname: '/foo',
    },
    {
      entryName: 'bar',
      pathname: '/bar',
    },
  ]);

  expect(
    formatRoutes(
      {
        index: 'src/index.ts',
        foo: 'src/index.ts',
      },
      '/',
      '/hello',
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/hello/',
    },
    {
      entryName: 'foo',
      pathname: '/hello/foo',
    },
  ]);

  expect(
    formatRoutes(
      {
        index: 'src/index.ts',
        foo: 'src/index.ts',
      },
      '/',
      '/hello/',
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/hello/',
    },
    {
      entryName: 'foo',
      pathname: '/hello/foo',
    },
  ]);

  expect(
    formatRoutes(
      {
        foo: 'src/index.ts',
        bar: 'src/index.ts',
        index: 'src/index.ts',
      },
      '/',
      undefined,
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/',
    },
    {
      entryName: 'foo',
      pathname: '/foo',
    },
    {
      entryName: 'bar',
      pathname: '/bar',
    },
  ]);

  expect(
    formatRoutes(
      {
        foo: 'src/index.ts',
      },
      '/',
      undefined,
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'foo',
      pathname: '/foo',
    },
  ]);

  expect(
    formatRoutes(
      {
        index: 'src/index.ts',
        foo: 'src/index.ts',
        bar: 'src/index.ts',
      },
      '/',
      'html',
      undefined,
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/html/',
    },
    {
      entryName: 'foo',
      pathname: '/html/foo',
    },
    {
      entryName: 'bar',
      pathname: '/html/bar',
    },
  ]);

  expect(
    formatRoutes(
      {
        index: 'src/index.ts',
      },
      '/',
      'html',
      'nested',
    ),
  ).toEqual([
    {
      entryName: 'index',
      pathname: '/html/index',
    },
  ]);
});

test('should handle URL path helpers correctly', () => {
  expect(joinUrlPath('', '')).toBe('');
  expect(joinUrlPath('', '/main')).toBe('/main');
  expect(joinUrlPath('/base', '')).toBe('/base');
  expect(joinUrlPath('/base', '/')).toBe('/base/');
  expect(joinUrlPath('/base', '/main')).toBe('/base/main');
  expect(joinUrlPath('/base/', '/main')).toBe('/base/main');

  expect(removeBasePath('/base', '/base')).toBe('/');
  expect(removeBasePath('/base?foo=1', '/base')).toBe('/?foo=1');
  expect(removeBasePath('/base#foo', '/base')).toBe('/#foo');
  expect(removeBasePath('/base/', '/base')).toBe('/');
  expect(removeBasePath('/base/foo', '/base')).toBe('/foo');
  expect(removeBasePath('/base/foo?foo=1', '/base')).toBe('/foo?foo=1');
  expect(removeBasePath('/baseball', '/base')).toBe('/baseball');

  expect(isUrlPathUnderBase('/base', '/base')).toBe(true);
  expect(isUrlPathUnderBase('/base/foo', '/base')).toBe(true);
  expect(isUrlPathUnderBase('/baseball', '/base')).toBe(false);
});

test('should print server URLs correctly', () => {
  let message: string | null;

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
      {
        url: 'http://192.168.0.1:3000/',
        label: 'network',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
    ],
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local     http://localhost:3000/
      ➜  network   http://192.168.0.1:3000/"
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
      {
        url: 'http://192.168.0.1:3000/',
        label: 'network',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
      {
        entryName: 'foo',
        pathname: '/html/foo',
      },
      {
        entryName: 'bar',
        pathname: '/bar',
      },
    ],
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  index    http://localhost:3000/
      -  foo      http://localhost:3000/html/foo
      -  bar      http://localhost:3000/bar

      ➜  network
      -  index    http://192.168.0.1:3000/
      -  foo      http://192.168.0.1:3000/html/foo
      -  bar      http://192.168.0.1:3000/bar"
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [],
    routes: [],
    cliShortcutsEnabled: true,
  });

  expect(message).toEqual(null);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
      {
        url: 'http://192.168.0.1:3000/',
        label: 'network',
      },
    ],
    routes: [],
    fallbackPathname: '/foo',
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local     http://localhost:3000/foo/
      ➜  network   http://192.168.0.1:3000/foo/"
  `);
});

test('should limit printed server routes correctly', () => {
  let message: string | null;

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: Array.from({ length: 12 }, (_, index) => ({
      entryName: `route${index}`,
      pathname: `/route${index}`,
    })),
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  route0    http://localhost:3000/route0
      -  route1    http://localhost:3000/route1
      -  route2    http://localhost:3000/route2
      -  route3    http://localhost:3000/route3
      -  route4    http://localhost:3000/route4
      -  route5    http://localhost:3000/route5
      -  route6    http://localhost:3000/route6
      -  route7    http://localhost:3000/route7
      -  route8    http://localhost:3000/route8
      -  route9    http://localhost:3000/route9
      ... 2 more entries, press u + enter to show all"
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: Array.from({ length: 12 }, (_, index) => ({
      entryName: `route${index}`,
      pathname: `/route${index}`,
    })),
    cliShortcutsEnabled: false,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  route0    http://localhost:3000/route0
      -  route1    http://localhost:3000/route1
      -  route2    http://localhost:3000/route2
      -  route3    http://localhost:3000/route3
      -  route4    http://localhost:3000/route4
      -  route5    http://localhost:3000/route5
      -  route6    http://localhost:3000/route6
      -  route7    http://localhost:3000/route7
      -  route8    http://localhost:3000/route8
      -  route9    http://localhost:3000/route9
      ... 2 more entries, set server.printUrls.maxRoutes to show more
    "
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
      {
        entryName: 'foo',
        pathname: '/foo',
      },
      {
        entryName: 'bar',
        pathname: '/bar',
      },
    ],
    printUrls: {
      maxRoutes: 2,
    },
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  index    http://localhost:3000/
      -  foo      http://localhost:3000/foo
      ... 1 more entries, press u + enter to show all"
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
      {
        entryName: 'foo',
        pathname: '/foo',
      },
      {
        entryName: 'bar',
        pathname: '/bar',
      },
    ],
    printUrls: {
      maxRoutes: 2,
    },
    cliShortcutsEnabled: false,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  index    http://localhost:3000/
      -  foo      http://localhost:3000/foo
      ... 1 more entries, set server.printUrls.maxRoutes to show more
    "
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
      {
        entryName: 'foo',
        pathname: '/foo',
      },
    ],
    printUrls: {
      maxRoutes: 0,
    },
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local     http://localhost:3000"
  `);

  message = printServerURLs({
    port: 3000,
    protocol: 'http',
    logger,
    urls: [
      {
        url: 'http://localhost:3000',
        label: 'local',
      },
    ],
    routes: [
      {
        entryName: 'index',
        pathname: '/',
      },
      {
        entryName: 'foo',
        pathname: '/foo',
      },
      {
        entryName: 'bar',
        pathname: '/bar',
      },
    ],
    printUrls: {
      maxRoutes: 1,
    },
    showAllRoutes: true,
    cliShortcutsEnabled: true,
  });

  expect(message!).toMatchInlineSnapshot(`
    "  ➜  local
      -  index    http://localhost:3000/
      -  foo      http://localhost:3000/foo
      -  bar      http://localhost:3000/bar"
  `);
});

describe('dev server', () => {
  test('should detect client compilers correctly', () => {
    expect(isClientCompiler(rspack({}))).toBeTruthy();

    expect(
      isClientCompiler(
        rspack({
          target: ['web', 'es5'],
        }),
      ),
    ).toBeTruthy();

    expect(
      isClientCompiler(
        rspack({
          target: 'node',
        }),
      ),
    ).toBeFalsy();

    expect(
      isClientCompiler(
        rspack({
          target: ['node'],
        }),
      ),
    ).toBeFalsy();
  });
});

test('should use Http2SecureServer when https and proxy are both enabled', async () => {
  const middlewares = ((_: unknown, __: unknown, next: () => void) =>
    next()) as unknown as Connect.Server;

  const server = await createHttpServer({
    serverConfig: {
      https: {},
      proxy: {
        '/api': 'http://127.0.0.1:3001',
      },
    },
    middlewares,
  });

  expect(server.constructor.name).toBe('Http2SecureServer');
});

test('should match local origins correctly', () => {
  expect(defaultAllowedOrigins.test('http://localhost:3000')).toBeTruthy();
  expect(defaultAllowedOrigins.test('http://foo.localhost:3000')).toBeTruthy();
  expect(defaultAllowedOrigins.test('http://127.0.0.1:3000')).toBeTruthy();
  expect(defaultAllowedOrigins.test('http://[::1]:3000')).toBeTruthy();

  // HTTPS protocols
  expect(defaultAllowedOrigins.test('https://localhost:3000')).toBeTruthy();
  expect(defaultAllowedOrigins.test('https://127.0.0.1:8080')).toBeTruthy();
  expect(defaultAllowedOrigins.test('https://foo.localhost:3000')).toBeTruthy();
  expect(defaultAllowedOrigins.test('https://[::1]:3000')).toBeTruthy();

  // Without port
  expect(defaultAllowedOrigins.test('http://localhost')).toBeTruthy();
  expect(defaultAllowedOrigins.test('https://127.0.0.1')).toBeTruthy();
  expect(defaultAllowedOrigins.test('http://[::1]')).toBeTruthy();

  // Multi-level subdomains
  expect(defaultAllowedOrigins.test('http://test.dev.localhost:8000')).toBeTruthy();

  // High port
  expect(defaultAllowedOrigins.test('http://localhost:65535')).toBeTruthy();

  // Invalid cases
  expect(defaultAllowedOrigins.test('http://example.com')).toBeFalsy();
  expect(defaultAllowedOrigins.test('http://192.168.1.1:3000')).toBeFalsy();
  expect(defaultAllowedOrigins.test('ftp://localhost:21')).toBeFalsy();
  expect(defaultAllowedOrigins.test('localhost')).toBeFalsy(); //
});

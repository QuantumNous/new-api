import { expect, test } from '@e2e/helper';
import type { RsbuildPluginAPI } from '@rsbuild/core';

test('should allow to access manifest data in environment context after build', async ({
  build,
}) => {
  let webManifest: Record<string, any> = {};
  let nodeManifest: Record<string, any> = {};

  await build({
    config: {
      output: {
        filenameHash: false,
      },
      environments: {
        web: {
          output: {
            manifest: true,
          },
        },
        node: {
          output: {
            target: 'node',
            manifest: 'manifest-node.json',
          },
        },
      },
      plugins: [
        {
          name: 'test',
          setup(api: RsbuildPluginAPI) {
            api.onAfterBuild(({ environments }) => {
              if (environments.web.manifest) {
                webManifest = environments.web.manifest;
              }
              if (environments.node.manifest) {
                nodeManifest = environments.node.manifest;
              }
            });
          },
        },
      ],
    },
  });

  // index.js, index.html
  expect(Object.keys(webManifest.allFiles).length).toBe(2);
  expect(webManifest.entries.index).toMatchObject({
    initial: {
      js: ['/static/js/index.js'],
    },
    html: ['/index.html'],
  });

  // index.js
  expect(Object.keys(nodeManifest.allFiles).length).toBe(1);
  expect(nodeManifest.entries.index).toMatchObject({
    initial: {
      js: ['/index.js'],
    },
  });
});

test('should allow to access manifest data in environment context after dev build', async ({
  dev,
}) => {
  let webManifest: Record<string, any> = {};
  let nodeManifest: Record<string, any> = {};

  await dev({
    config: {
      output: {
        filenameHash: false,
      },
      environments: {
        web: {
          output: {
            manifest: true,
          },
        },
        node: {
          output: {
            target: 'node',
            manifest: 'manifest-node.json',
          },
        },
      },
      plugins: [
        {
          name: 'test',
          setup(api: RsbuildPluginAPI) {
            api.onAfterDevCompile(({ environments }) => {
              if (environments.web.manifest) {
                webManifest = environments.web.manifest;
              }
              if (environments.node.manifest) {
                nodeManifest = environments.node.manifest;
              }
            });
          },
        },
      ],
    },
  });

  // index.js, index.js.map, index.html
  expect(Object.keys(webManifest.allFiles).length).toBe(3);
  expect(webManifest.entries.index).toMatchObject({
    initial: {
      js: ['/static/js/index.js'],
    },
    html: ['/index.html'],
  });

  // index.js, index.js.map
  expect(Object.keys(nodeManifest.allFiles).length).toBe(2);
  expect(nodeManifest.entries.index).toMatchObject({
    initial: {
      js: ['/index.js'],
    },
  });
});

test('should allow to access manifest data in environment API', async ({ dev, page }) => {
  let webManifest: Record<string, any> | undefined = {};
  let nodeManifest: Record<string, any> | undefined = {};

  const rsbuild = await dev({
    config: {
      output: {
        filenameHash: false,
      },
      environments: {
        web: {
          output: {
            manifest: true,
          },
        },
        node: {
          output: {
            target: 'node',
            manifest: 'manifest-node.json',
          },
        },
      },
      server: {
        setup: ({ action, server }) => {
          if (action !== 'dev') {
            return;
          }
          server.middlewares.use(async (_req, _res, next) => {
            webManifest = server.environments.web.context.manifest;
            nodeManifest = server.environments.node.context.manifest;
            next();
          });
        },
      },
    },
  });

  // should visit base url correctly
  await page.goto(`http://localhost:${rsbuild.port}`);

  // index.js, index.js.map, index.html
  expect(Object.keys(webManifest.allFiles).length).toBe(3);
  expect(webManifest.entries.index).toMatchObject({
    initial: {
      js: ['/static/js/index.js'],
    },
    html: ['/index.html'],
  });

  // index.js, index.js.map
  expect(Object.keys(nodeManifest.allFiles).length).toBe(2);
  expect(nodeManifest.entries.index).toMatchObject({
    initial: {
      js: ['/index.js'],
    },
  });
});

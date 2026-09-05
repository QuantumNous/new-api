import { defineConfig, type RequestHandler } from '@rsbuild/core';

export default defineConfig({
  server: {
    setup: ({ action, server }) => {
      if (action !== 'dev') {
        return;
      }

      const middleware: RequestHandler = async (req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/check') {
          next();
          return;
        }

        try {
          const bundle = await server.environments.node.loadBundle<{
            getPayload: () => string;
          }>('index');

          res.setHeader('Content-Type', 'text/plain');
          res.end(bundle.getPayload());
        } catch (error) {
          res.statusCode = 500;
          res.end(String(error));
        }
      };

      server.middlewares.use(middleware);
    },
  },
  environments: {
    web: {},
    node: {
      output: {
        target: 'node',
      },
      source: {
        entry: {
          index: './src/index.server.js',
        },
      },
      tools: {
        rspack: {
          optimization: {
            chunkIds: 'natural',
            runtimeChunk: true,
            splitChunks: {
              chunks: 'all',
              minSize: 0,
              cacheGroups: {
                shared: {
                  test: /shared/,
                  name: 'shared',
                  enforce: true,
                },
              },
            },
          },
        },
      },
    },
  },
});

import inspector from 'node:inspector';
import { defineConfig, logger, type RequestHandler, type RsbuildDevServer } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export const serverRender =
  ({ environments }: RsbuildDevServer): RequestHandler =>
  async (_req, res, _next) => {
    const bundle = await environments.node.loadBundle<{
      render: () => string;
    }>('index');
    const rendered = bundle.render();
    const template = await environments.web.getTransformedHtml('index');
    const html = template.replace('<!--app-content-->', rendered);

    res.writeHead(200, {
      'Content-Type': 'text/html',
    });
    res.end(html);
  };

export default defineConfig({
  plugins: [pluginReact()],
  dev: {
    // enable writeToDisk to make sure the sourcemap files are generated on disk for debugging
    writeToDisk: inspector.url() !== undefined,
  },
  server: {
    setup: ({ action, server }) => {
      if (action !== 'dev') {
        return;
      }

      const serverRenderMiddleware = serverRender(server);

      const middleware: RequestHandler = async (req, res, next) => {
        if (req.method === 'GET' && req.url === '/') {
          try {
            await serverRenderMiddleware(req, res, next);
          } catch (err) {
            logger.error('SSR render error, downgrade to CSR...');
            logger.error(err);
            next();
          }
        } else {
          next();
        }
      };

      server.middlewares.use(middleware);
    },
  },
  environments: {
    web: {
      source: {
        entry: {
          index: './src/index',
        },
      },
    },
    node: {
      output: {
        module: process.env.TEST_ESM_LIBRARY === 'true',
        target: 'node',
      },
      source: {
        entry: {
          index: './src/index.server',
        },
      },
      tools: {
        rspack: process.env.TEST_ESM_LIBRARY
          ? {
              output: {
                filename: '[name].mjs',
                chunkFilename: '[name].mjs',
              },
            }
          : process.env.TEST_SPLIT_CHUNK
            ? {
                optimization: {
                  runtimeChunk: true,
                  splitChunks: {
                    chunks: 'all',
                    minSize: 0,
                    cacheGroups: {
                      'lib-react': {
                        test: /node_modules[\\/](react|react-dom|scheduler|react-refresh|@rspack[\\/]plugin-react-refresh)[\\/]/,
                        priority: 0,
                        name: 'lib-react',
                      },
                    },
                  },
                },
              }
            : {},
      },
    },
  },
  html: {
    template: './template.html',
  },
});

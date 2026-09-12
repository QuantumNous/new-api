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
        target: 'node',
      },
      source: {
        entry: {
          index: './src/index.server',
        },
      },
    },
  },
  html: {
    template: './template.html',
  },
});

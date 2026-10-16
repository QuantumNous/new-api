module.exports = {
  // ...
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      devServer.app.get('/setup-middleware/some/path', (_, response) => {
        response.send('setup-middlewares option GET');
      });

      // Use the `unshift` method if you want to run a middleware before all other middlewares
      // or when you are migrating from the `onBeforeSetupMiddleware` option
      middlewares.unshift({
        name: 'first-in-array',
        // `path` is optional
        path: '/foo/path',
        middleware: (req, res) => {
          res.send('Foo!');
        },
      });

      // Use the `push` method if you want to run a middleware after all other middlewares
      // or when you are migrating from the `onAfterSetupMiddleware` option
      middlewares.push({
        name: 'hello-world-test-one',
        // `path` is optional
        path: '/foo/bar',
        middleware: (req, res) => {
          res.send('Foo Bar!');
        },
      });

      middlewares.push((req, res) => {
        res.send('Hello World!');
      });

      return middlewares;
    },
  },
};

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const bodyParser = require('body-parser');

i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: __dirname + '/public/locales/{{lng}}/{{ns}}.json',
      addPath: __dirname + '/public/locales/{{lng}}/{{ns}}.missing.json',
    },
    fallbackLng: 'en',
    // debug: true,
    saveMissing: true,
  });

module.exports = {
  devServer: (configFunction) => (proxy, allowedHost) => {
    const config = configFunction(proxy, allowedHost);
    config.setupMiddlewares = (middlewares, devServer) => {
      if (!devServer) throw new Error('webpack-dev-server is not defined');

      devServer.app.post(
        '/locales/:lng/:ns',
        bodyParser.json(),
        i18nextMiddleware.missingKeyHandler(i18next),
      );
      // addPath for client: http://localhost:3000/locales/{{lng}}/{{ns}}

      return middlewares;
    };
    return config;
  },
};

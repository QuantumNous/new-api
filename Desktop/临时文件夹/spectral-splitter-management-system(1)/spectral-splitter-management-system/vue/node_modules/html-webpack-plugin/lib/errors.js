// @ts-nocheck
'use strict';

let prettyError;

function getPrettyError () {
  if (!prettyError) {
    // lazily require to improve startup time since pretty-error is rather heavy package
    const PrettyError = require('pretty-error');
    prettyError = new PrettyError();
    prettyError.withoutColors();
    prettyError.skipPackage('html-plugin-evaluation');
    prettyError.skipNodeFiles();
    prettyError.skip(function (traceLine) {
      return traceLine.path === 'html-plugin-evaluation';
    });
  }
  return prettyError;
}

module.exports = function (err, context) {
  return {
    toHtml: function () {
      return 'Html Webpack Plugin:\n<pre>\n' + this.toString() + '</pre>';
    },
    toJsonHtml: function () {
      return JSON.stringify(this.toHtml());
    },
    toString: function () {
      try {
        return getPrettyError().render(err).replace(/webpack:\/\/\/\./g, context);
      } catch (e) {
        // This can sometimes fail. We don't know why, but returning the
        // original error is better than returning the error thrown by
        // pretty-error.
        return err;
      }
    }
  };
};


/**
 * lighthouse config
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
 module.exports = {
    ci: {
      collect: {
          staticDistDir: './storybook-static',
          url: ['http://localhost/iframe.html?id=base--semi-a-11-y&args=&viewMode=story'],
          isSinglePageApplication: true,
      },
      upload: {
        target: "temporary-public-storage",
      },
    },
  };
  
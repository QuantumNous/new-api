module.exports = {
  'getCurrentScript': function (browser) {
    browser
      .url(`${browser.launch_url}/fixtures/test.html`)
      .assert.containsText(
        '#app',
        `${browser.launch_url}/fixtures/log-src.js`
      )
      .end()
  },
  'getCurrentScript in microtask': function (browser) {
    browser
      .url(`${browser.launch_url}/fixtures/test-microtask.html`)
      .assert.containsText(
        '#app',
        `${browser.launch_url}/fixtures/log-src-in-microtask.js`
      )
      .end()
  },
  'use it as a polyfill': function (browser) {
    browser
      .url(`${browser.launch_url}/fixtures/test-polyfill.html`)
      .assert.containsText(
        '#app',
        'It works!'
      )
      .end()
  }
}

var app = document.getElementById('app')
if (typeof Promise === 'undefined') {
  // skip this test in IE
  app.textContent = window.getCurrentScript().src
} else {
  Promise.resolve().then(function() {
    app.textContent = window.getCurrentScript().src
  })
}

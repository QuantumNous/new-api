if (!('currentScript' in document)) {
  Object.defineProperty(document, 'currentScript', { get: window.getCurrentScript })
}

if (document.currentScript) {
  document.getElementById('app').textContent = 'It works!'
}

/// <reference types="@rsbuild/core/types" />

console.log('hello');

declare global {
  interface Window {
    __count?: number;
  }
}

if (import.meta.webpackHot) {
  // Expose a counter on window so the test can assert handler disposal behavior.
  if (typeof window.__count === 'undefined') {
    window.__count = 0;
  }

  import.meta.webpackHot.on('count', () => {
    window.__count! += 1;
  });

  import.meta.webpackHot.accept();
}

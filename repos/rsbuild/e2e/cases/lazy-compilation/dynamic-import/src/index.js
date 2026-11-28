console.log('entry');

import('./foo').then(({ foo }) => {
  console.log(foo);
});

window.foo = new Promise((resolve) => {
  window.__resolveFoo = resolve;
});

import './style.css';

window.test = 'aaaa';

import(
  /* rspackChunkName: "foo" */
  './foo'
).then(({ foo }) => {
  window.answer = foo();
});

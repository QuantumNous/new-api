import './style.css';

import(
  /* rspackChunkName: "foo" */
  './foo'
).then(({ foo }) => {
  window.answer = `another ${foo()}`;
});

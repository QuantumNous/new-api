import './index.css';

import(
  /* rspackChunkName: "foo" */
  './foo'
);

document.getElementById('root').innerHTML = 'Hello Rsbuild!';

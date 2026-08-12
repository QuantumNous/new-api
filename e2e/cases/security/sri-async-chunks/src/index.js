import './index.css';

import('./foo').then(({ foo }) => {
  document.getElementById('root').innerHTML = foo;
});

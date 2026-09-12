import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import('../test').then((res) => {
  console.log('res', res);
});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}

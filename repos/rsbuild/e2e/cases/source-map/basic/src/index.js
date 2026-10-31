import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import './index.css';

window.test = 2;

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}

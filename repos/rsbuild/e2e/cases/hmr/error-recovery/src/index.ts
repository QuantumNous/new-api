import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const num = Math.ceil(Math.random() * 100);
const testEl = document.createElement('div');
testEl.id = 'test-keep';

testEl.innerHTML = String(num);

document.body.appendChild(testEl);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}

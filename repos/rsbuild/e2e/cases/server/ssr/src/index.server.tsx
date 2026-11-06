import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from './App';
import { assert } from './assert.server';

console.log('load SSR');

// test dynamic import
import('./test');

// assert environment
assert();

export function render() {
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

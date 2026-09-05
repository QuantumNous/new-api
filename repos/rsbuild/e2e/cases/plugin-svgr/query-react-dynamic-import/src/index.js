import React from 'react';
import { createRoot } from 'react-dom/client';
import { getApp } from './App';

async function main() {
  const container = document.getElementById('root');
  if (container) {
    const App = await getApp();
    const root = createRoot(container);
    root.render(React.createElement(App));
  }
}

main();

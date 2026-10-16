import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * @preserve AAAA
 */

/**
 * @license BBB
 */

/*! Legal Comment CCC */

// Foo Bar

/*
 Foo Bar
 */
function App() {
  return (
    <div>
      <div id="test">Hello Rsbuild!</div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}

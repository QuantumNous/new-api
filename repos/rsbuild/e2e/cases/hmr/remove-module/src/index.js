import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './Button';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(Button));
}

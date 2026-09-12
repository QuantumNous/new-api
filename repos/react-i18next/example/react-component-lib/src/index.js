import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// import i18n (needs to be bundled ;))
import './i18n';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

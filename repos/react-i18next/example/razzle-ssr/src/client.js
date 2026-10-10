import { BrowserRouter } from 'react-router-dom';
import React, { Suspense } from 'react';
import { hydrate } from 'react-dom';
import { useSSR } from 'react-i18next';
import App from './App';
import './i18n';

const BaseApp = () => {
  useSSR(window.initialI18nStore, window.initialLanguage);
  return (
    <Suspense fallback={<div>Still loading i18n...</div>}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Suspense>
  );
};

hydrate(<BaseApp />, document.getElementById('root'));

if (module.hot) {
  module.hot.accept();
}

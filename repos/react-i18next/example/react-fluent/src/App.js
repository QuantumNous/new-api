import React, { Suspense } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import logo from './logo.svg';
import './App.css';

// page uses the hook
function Page() {
  const { t, i18n } = useTranslation('translations');
  console.log(JSON.stringify(i18n.store.data), null, 2);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="App">
      <div className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h2>{t('title')}</h2>
        <button onClick={() => changeLanguage('de')}>de</button>
        <button onClick={() => changeLanguage('en')}>en</button>
      </div>
      <div className="App-intro">
        <Trans i18nKey="description_1">
          To get started, edit <code>src/App.js</code> and save to reload.
        </Trans>
      </div>
      <div>{t('description_2')}</div>
      <Trans i18nKey="emails" values={{ unreadEmails: 5 }}>
        You have <strong>one</strong> unread email.
      </Trans>
    </div>
  );
}

// loading component for suspense fallback
const Loader = () => (
  <div className="App">
    <img src={logo} className="App-logo" alt="logo" />
    <div>loading...</div>
  </div>
);

// here app catches the suspense from page in case translations are not yet loaded
export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Page />
    </Suspense>
  );
}

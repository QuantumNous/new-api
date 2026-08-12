import React, { Component, Suspense } from 'react';
import { withTranslation, Trans } from 'react-i18next';
import logo from './logo.svg';
import './App.css';

import ComponentUseTranslation from './UseTranslation';

class AppPage extends Component {
  render() {
    const { t, i18n } = this.props;

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
          <Trans i18nKey="description.part1">
            To get started, edit <code>src/App.js</code> and save to reload.
          </Trans>
        </div>
        <ComponentUseTranslation />
      </div>
    );
  }
}

const Page = withTranslation('translations')(AppPage);

// here app catches the suspense from page in case translations are not yet loaded
export default function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Page />
    </Suspense>
  );
}

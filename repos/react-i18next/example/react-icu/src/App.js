import React, { Component, Suspense } from 'react';
import { withTranslation, Trans } from 'react-i18next';
import logo from './logo.svg';
import './App.css';

import ComponentUsingMacro from './ComponentUsingMacro';
import ComponentUsingMacroInterpolated from './ComponentUsingMacroInterpolated';

class Page extends Component {
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
          <button onClick={() => changeLanguage('ru')}>ru</button>
        </div>
        <div className="App-intro">
          <Trans i18nKey="description.part1">
            To get started, edit <code>src/App.js</code> and save to reload.
          </Trans>
        </div>
        <div>{t('description.part2')}</div>
        <hr />
        <Trans
          i18nKey="icu_and_trans"
          defaults="We have <0>0 persons</0> invited."
          components={[<strong>dummy</strong>]}
          values={{ numPersons: 1003 }}
        />
        <div>{t('icu', { numPersons: 501 })}</div>
        <ComponentUsingMacro />
        <ComponentUsingMacroInterpolated />
      </div>
    );
  }
}

const PageWithTranslation = withTranslation('translations')(Page);

// here app catches the suspense from page in case translations are not yet loaded
export default function App() {
  return (
    <Suspense fallback="Loading...">
      <PageWithTranslation />
    </Suspense>
  );
}

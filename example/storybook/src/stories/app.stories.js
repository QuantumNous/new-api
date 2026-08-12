import React from 'react';
import App from '../App';

// for this case we have set i18n.use(initReactI18next) in '../src/i18n' so no I18nextProvicer is needed to pass i18n down via context api
export default {
  title: 'Full App',
  component: App,
};

export const Default = () => <App />;

// learn more:
// https://react.i18next.com/components/overview#getting-the-t-function

import { useContext } from 'react';
import { getI18n, I18nContext } from './context.js';
import { warnOnce } from './utils.js';

export const useSSR = (initialI18nStore, initialLanguage, props = {}) => {
  const { i18n: i18nFromProps } = props;
  const { i18n: i18nFromContext } = useContext(I18nContext) || {};
  const i18n = i18nFromProps || i18nFromContext || getI18n();

  if (!i18n) {
    warnOnce(
      i18n,
      'NO_I18NEXT_INSTANCE',
      'useSSR: You will need to pass in an i18next instance by using initReactI18next or by passing it via props or context. In monorepo setups, make sure there is only one instance of react-i18next.',
    );
    return;
  }

  // opt out if is a cloned instance, eg. created by i18next-http-middleware on request
  // -> do not set initial stuff on server side
  if (i18n.options?.isClone) return;

  // nextjs / SSR: getting data from next.js or other ssr stack
  if (initialI18nStore && !i18n.initializedStoreOnce) {
    if (!i18n.services?.resourceStore) {
      warnOnce(
        i18n,
        'I18N_NOT_INITIALIZED',
        'useSSR: i18n instance was found but not initialized (services.resourceStore is missing). Make sure you call i18next.init() before using useSSR — e.g. at module level, not only in getStaticProps/getServerSideProps.',
      );
      return;
    }
    i18n.services.resourceStore.data = initialI18nStore;

    // add namespaces to the config - so a languageChange call loads all namespaces needed
    i18n.options.ns = Object.values(initialI18nStore).reduce((mem, lngResources) => {
      Object.keys(lngResources).forEach((ns) => {
        if (mem.indexOf(ns) < 0) mem.push(ns);
      });
      return mem;
    }, i18n.options.ns);

    i18n.initializedStoreOnce = true;
    i18n.isInitialized = true;
  }

  if (initialLanguage && !i18n.initializedLanguageOnce) {
    i18n.changeLanguage(initialLanguage);
    i18n.initializedLanguageOnce = true;
  }
};

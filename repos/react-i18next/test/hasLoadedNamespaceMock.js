export default (ns, i18n, options = {}) => {
  const lng = i18n.languages[0];
  const fallbackLng = i18n.options ? i18n.options.fallbackLng : false;
  const lastLng = i18n.languages[i18n.languages.length - 1];

  // we're in cimode so this shall pass
  if (lng.toLowerCase() === 'cimode') return true;

  const loadNotPending = (l, n) => {
    const loadState = i18n.services.backendConnector.state[`${l}|${n}`];
    return loadState === -1 || loadState === 2;
  };

  // bound to trigger on event languageChanging
  // so set ready to false while we are changing the language
  // and namespace pending (depends on having a backend)
  if (
    options.bindI18n &&
    options.bindI18n.indexOf('languageChanging') > -1 &&
    i18n.services.backendConnector.backend &&
    i18n.isLanguageChangingTo &&
    !loadNotPending(i18n.isLanguageChangingTo, ns)
  )
    return false;

  // loaded -> SUCCESS
  if (i18n.hasResourceBundle(lng, ns)) return true;

  // were not loading at all -> SEMI SUCCESS
  if (
    !i18n.services.backendConnector.backend ||
    (i18n.options.resources && !i18n.options.partialBundledLanguages)
  )
    return true;

  // failed loading ns - but at least fallback is not pending -> SEMI SUCCESS
  if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;

  return false;
};

import i18next from './i18next.js';

export { default as keyFromSelector } from './selector.js';

export default i18next;

export const createInstance = i18next.createInstance;

export const dir = i18next.dir;
export const init = i18next.init;
export const loadResources = i18next.loadResources;
export const reloadResources = i18next.reloadResources;
export const use = i18next.use;
export const changeLanguage = i18next.changeLanguage;
export const getFixedT = i18next.getFixedT;
export const t = i18next.t;
export const exists = i18next.exists;
export const setDefaultNamespace = i18next.setDefaultNamespace;
export const hasLoadedNamespace = i18next.hasLoadedNamespace;
export const loadNamespaces = i18next.loadNamespaces;
export const loadLanguages = i18next.loadLanguages;

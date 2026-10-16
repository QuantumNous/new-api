import i18next from 'i18next';
// using json imports would work, but interpolation checks would not work
// import ns1 from './en/ns1.json';
// import ns2 from './en/ns2.json';
import ns1 from './en/ns1.js';
import ns2 from './en/ns2.js';

export const defaultNS = 'ns1';

export const resources = {
  en: {
    ns1,
    ns2,
  },
};

i18next.init({
  lng: 'en', // if you're using a language detector, do not define the lng option
  debug: true,
  resources,
  defaultNS,
});

import i18n from 'i18next';

// set instance on hooks stuff
import { setI18n } from '../src/context';

setI18n(i18n);

i18n.init({
  defaultNS: 'ns1',
  resources: {
    ns1: {
      testString: 'This has an interpolated <el1>link</el1> and <el2>%{buttonText}</el2>',
    },
  },
});

export default i18n;

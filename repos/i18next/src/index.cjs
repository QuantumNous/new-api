import i18next from './i18next.js';
import keyFromSelector from './selector.js';

i18next.keyFromSelector = keyFromSelector;

// for cjs there is just 1 default export, no named exports
export default i18next;

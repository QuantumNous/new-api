import { BASE_CLASS_PREFIX } from '../base/constants';

const PREFIX = `${BASE_CLASS_PREFIX}-toast`;
const cssClasses = {
    PREFIX,
    WRAPPER: `${PREFIX}-wrapper`,
    LIST: `${PREFIX}-list`,
};

const strings = {
    types: ['warning', 'success', 'info', 'error', 'default'],
    themes: ['normal', 'light'],
    directions: ['ltr', 'rtl'],
};

const numbers = {
    duration: 3 // default close time, unit: s
};

export { cssClasses, strings, numbers };

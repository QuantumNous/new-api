import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    WRAPPER: `${BASE_CLASS_PREFIX}-notification-wrapper`,
    LIST: `${BASE_CLASS_PREFIX}-notification-list`,
    NOTICE: `${BASE_CLASS_PREFIX}-notification-notice`
};

const strings = {
    types: ['warning', 'success', 'info', 'error', 'default'],
    themes: ['normal', 'light'],
    directions: ['ltr', 'rtl'] as const,
};

const numbers = {
    duration: 3 // default close time, unit: s
};

export { cssClasses, strings, numbers };

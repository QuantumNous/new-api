import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-input`,
} as const;

const strings = {
    SIZE: ['small', 'large', 'default'],
    DEFAULT_SIZE: 'default',
    STATUS: ['default', 'error', 'warning', 'success'],
    CLEARBTN_CLICKED_EVENT_FLAG: '__fromClearBtn',
    MODE: ['password'],
} as const;

const numbers = {};

export { cssClasses, strings, numbers };

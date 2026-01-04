import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-page`
} as const;

const strings = {} as const;

const numbers = {
    PAGE_SHOW_MAX: 7,
    REST_PAGE_SHOW_MAX: 5,
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTION: [10, 20, 40, 100],
    REST_PAGE_MAX_SIZE: 1000000,
} as const;

export { cssClasses, strings, numbers };

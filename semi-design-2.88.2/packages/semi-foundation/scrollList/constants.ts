import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-scrolllist`,
    SELECTED: `${BASE_CLASS_PREFIX}-scrolllist-item-selected`,
};

const strings = {
    MODE: ['normal', 'wheel'],
} as const;

const numbers = {
    DEFAULT_ITEM_HEIGHT: 36,
    DEFAULT_SCROLL_DURATION: 120,
};

export { cssClasses, strings, numbers };

import {
    VALIDATE_STATUS,
    BASE_CLASS_PREFIX
} from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-tree-select`,
    PREFIX_TREE: `${BASE_CLASS_PREFIX}-tree`,
    PREFIX_OPTION: `${BASE_CLASS_PREFIX}-tree-select-option`
};

const strings = {
    SIZE_SET: ['small', 'large', 'default'],
    SEARCH_POSITION_DROPDOWN: 'dropdown',
    SEARCH_POSITION_TRIGGER: 'trigger',
    STATUS: VALIDATE_STATUS
} as const;

const numbers = {};

export {
    cssClasses,
    strings,
    numbers
};

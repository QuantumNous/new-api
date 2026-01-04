import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-cascader`,
    PREFIX_OPTION: `${BASE_CLASS_PREFIX}-cascader-option`
};

const strings = {
    SIZE_SET: ['small', 'large', 'default'],
    VALIDATE_STATUS: ['success', 'default', 'error', 'warning'] as const,
    IS_KEY: 'isKey',
    IS_VALUE: 'isValue',
    SHOW_NEXT_BY_CLICK: 'click',
    SHOW_NEXT_BY_HOVER: 'hover',
    /* Merge Type */
    LEAF_ONLY_MERGE_TYPE: 'leafOnly',
    AUTO_MERGE_VALUE_MERGE_TYPE: 'autoMergeValue',
    NONE_MERGE_TYPE: 'none',
    SEARCH_POSITION_TRIGGER: 'trigger',
    SEARCH_POSITION_CUSTOM: 'custom',
    RELATED: 'related',
    UN_RELATED: 'unRelated'
} as const;

const numbers = {};

export {
    cssClasses,
    strings,
    numbers
};

export const VALUE_SPLIT = '_SEMI_CASCADER_SPLIT_';

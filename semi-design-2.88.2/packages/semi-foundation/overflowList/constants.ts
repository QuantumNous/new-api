import {
    BASE_CLASS_PREFIX
} from '../base/constants';

const cssClasses = {
    PREFIX: BASE_CLASS_PREFIX + '-overflow-list',
};

const MODE_MAP = {
    COLLAPSE: 'collapse',
    SCROLL: 'scroll',
};

const BOUNDARY_MAP = {
    START: 'start',
    END: 'end',
} as const;

const OVERFLOW_DIR = {
    NONE: 0,
    GROW: 1,
    SHRINK: 2,
};

const strings = {
    BOUNDARY_SET: Object.values(BOUNDARY_MAP),
    POSITION_SET: ['vertical', 'horizontal'],
    MODE_SET: Object.values(MODE_MAP),
    MODE_MAP,
    BOUNDARY_MAP,
    OVERFLOW_DIR
};

const numbers = {
    MINIMUM_HTML_ELEMENT_WIDTH: 4
};

export {
    cssClasses,
    strings,
    numbers
};
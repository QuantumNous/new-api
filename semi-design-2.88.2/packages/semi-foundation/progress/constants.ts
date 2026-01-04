import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-progress`,
};

const strings = {
    types: ['line', 'circle'],
    DEFAULT_TYPE: 'line',
    STROKE_DEFAULT: 'var(--semi-color-success)',
    strokeLineCap: ['square', 'round'],
    DEFAULT_LINECAP: 'round',
    sizes: ['default', 'small', 'large'],
    DEFAULT_SIZE: 'default',
    directions: ['vertical', 'horizontal'],
    DEFAULT_DIRECTION: 'horizontal',
};

const numbers = {};

export { cssClasses, strings };

import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-calendar`,
};

const strings = {
    MODE: ['day', 'week', 'month', 'range'],
} as const;

export {
    cssClasses,
    strings
};
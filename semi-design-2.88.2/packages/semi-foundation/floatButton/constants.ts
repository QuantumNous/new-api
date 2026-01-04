import {
    BASE_CLASS_PREFIX
} from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX }-floatButton`,
} as const;

const cssClassesGroup = {
    PREFIX: `${BASE_CLASS_PREFIX }-floatButtonGroup`,
} as const;


const strings = {
    SHAPE: ['square', 'round'],
    SIZE: ['small', 'default', 'large'],
} as const;

export {
    cssClasses,
    cssClassesGroup,
    strings
};
import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-sidesheet`,
    DIALOG: `${BASE_CLASS_PREFIX}-modal`,
};

const strings = {
    PLACEMENT: ['top', 'right', 'bottom', 'left'],
    SIZE: ['small', 'medium', 'large'],
    WIDTH: {
        small: 448,
        medium: 684,
        large: 920
    },
    HEIGHT: 448,
};

export {
    cssClasses,
    strings
};
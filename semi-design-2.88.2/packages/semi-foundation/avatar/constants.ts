import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-avatar`,
};

const strings = {
    SHAPE: ['circle', 'square'],
    SIZE: ['extra-extra-small', 'extra-small', 'small', 'default', 'medium', 'large', 'extra-large'],
    COLOR: [
        'grey',
        'red',
        'pink',
        'purple',
        'violet',
        'indigo',
        'blue',
        'light-blue',
        'cyan',
        'teal',
        'green',
        'light-green',
        'lime',
        'yellow',
        'amber',
        'orange',
        'white',
    ],
    OVERLAP_FROM: ['start', 'end'],
};

export { cssClasses, strings };

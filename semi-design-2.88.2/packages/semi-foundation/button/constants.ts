import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-button`,
};

const strings = {
    sizes: ['default', 'small', 'large'],
    iconPositions: ['left', 'right'],
    htmlTypes: ['button', 'reset', 'submit'],
    btnTypes: ['primary', 'secondary', 'tertiary', 'warning', 'danger'],
    themes: ['solid', 'borderless', 'light', 'outline'],
    DEFAULT_ICON_SIZE: 'default',
    DEFAULT_ICON_POSITION: 'left',
} as const;

const numbers = {};

export { cssClasses, strings, numbers };

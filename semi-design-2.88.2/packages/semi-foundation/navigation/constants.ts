import { BASE_CLASS_PREFIX } from '../base/constants';

const MODE_HORIZONTAL = 'horizontal';
const MODE_VERTICAL = 'vertical';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-navigation`,
};

const strings = {
    MODE: [MODE_VERTICAL, MODE_HORIZONTAL],
    MODE_VERTICAL,
    MODE_HORIZONTAL,
    ICON_POS_LEFT: 'left',
    ICON_POS_RIGHT: 'right',
    DEFAULT_LOGO_ICON_SIZE: 'extra-large',
    TOGGLE_ICON_LEFT: 'left',
    TOGGLE_ICON_RIGHT: 'right'
};

const numbers = {
    DEFAULT_SUBNAV_MAX_HEIGHT: 999,
    DEFAULT_TOOLTIP_SHOW_DELAY: 0, // ms
    DEFAULT_TOOLTIP_HIDE_DELAY: 100, // ms
    DEFAULT_SUBNAV_OPEN_DELAY: 0, // ms
    DEFAULT_SUBNAV_CLOSE_DELAY: 100, // ms
};

export { cssClasses, strings, numbers };

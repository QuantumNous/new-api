import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-tooltip`,
} as const;

const strings = {
    POSITION_SET: [
        'top',
        'topLeft',
        'topRight',
        'left',
        'leftTop',
        'leftBottom',
        'right',
        'rightTop',
        'rightBottom',
        'bottom',
        'bottomLeft',
        'bottomRight',
        'leftTopOver',
        'rightTopOver',
        'leftBottomOver',
        'rightBottomOver',
    ],
    TRIGGER_SET: ['hover', 'focus', 'click', 'custom', 'contextMenu'],
    STATUS_DISABLED: 'disabled',
    STATUS_LOADING: 'loading',
} as const;

const numbers = {
    ARROW_BOUNDING: {
        offsetX: 0,
        offsetY: 2,
        width: 24,
        height: 7,
    },
    DEFAULT_Z_INDEX: 1060,
    MOUSE_ENTER_DELAY: 50,
    MOUSE_LEAVE_DELAY: 50,
    SPACING: 8, // Values are consistent with spacing-tight in scss
    MARGIN: 0,
} as const;

export { cssClasses, strings, numbers };

import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-popconfirm`,
    POPOVER: `${BASE_CLASS_PREFIX}-popconfirm-popover`,
};

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
    ],
    TRIGGER_SET: ['hover', 'focus', 'click', 'custom'],
};

const numbers = {
    SPACING: 4,
    DEFAULT_Z_INDEX: 1030,
};

export { cssClasses, strings, numbers };

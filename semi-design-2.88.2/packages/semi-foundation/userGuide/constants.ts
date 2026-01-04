import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-userGuide`,
    PREFIX_MODAL: `${BASE_CLASS_PREFIX}-userGuide-modal`,
};

const strings = {
    MODE: ['popup', 'modal'],
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
    THEME: ['default', 'primary'],
};

const numbers = {
    DEFAULT_CURRENT: 0,
    DEFAULT_SPOTLIGHT_PADDING: 5,
    DEFAULT_Z_INDEX: 1030,
};

export { cssClasses, strings, numbers }; 
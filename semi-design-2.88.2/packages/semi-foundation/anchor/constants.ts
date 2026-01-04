import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-anchor`,
};

const strings = {
    SIZE: ['small', 'default'],
    SLIDE_COLOR: ['primary', 'tertiary', 'muted'],
    MAX_WIDTH: '200px',
    MAX_HEIGHT: '750px',
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
} as const;

export { cssClasses, strings };

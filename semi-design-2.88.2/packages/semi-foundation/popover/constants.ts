import { numbers as tooltipNumbers } from '../tooltip/constants';
import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-popover`,
    ARROW: `${BASE_CLASS_PREFIX}-popover-icon-arrow`,
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
    TRIGGER_SET: ['hover', 'focus', 'click', 'custom', 'contextMenu'],
    DEFAULT_ARROW_STYLE: {
        borderOpacity: '1',
        backgroundColor: 'var(--semi-color-bg-3)',
        // borderColor: 'var(--semi-color-shadow)',
        borderColor: 'var(--semi-color-border)',
    },
} as const;

const numbers = {
    ARROW_BOUNDING: {
        ...tooltipNumbers.ARROW_BOUNDING,
        offsetY: 6,
        offsetX: 0,
        height: 8,
    },
    SPACING: 4,
    SPACING_WITH_ARROW: 10,
    DEFAULT_Z_INDEX: 1030,
};

export { cssClasses, strings, numbers };

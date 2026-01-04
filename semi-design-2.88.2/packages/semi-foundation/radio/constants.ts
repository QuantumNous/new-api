import { BASE_CLASS_PREFIX } from '../base/constants';

const radioClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-radio`,
    INNER: `${BASE_CLASS_PREFIX}-radio-inner`,
    TEXT: `${BASE_CLASS_PREFIX}-radio-text`,
    INPUT: `${BASE_CLASS_PREFIX}-radio-input`,
    CHECKED: `${BASE_CLASS_PREFIX}-radio-checked`,
    DISABLED: `${BASE_CLASS_PREFIX}-radio-disabled`,
    BUTTON: `${BASE_CLASS_PREFIX}-radio-button`,
} as const;

const radioGroupClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-radioGroup`,
    INNER: `${BASE_CLASS_PREFIX}-radioGroup-inner`,
    TEXT: `${BASE_CLASS_PREFIX}-radioGroup-text`,
    INPUT: `${BASE_CLASS_PREFIX}-radioGroup-input`,
    CHECKED: `${BASE_CLASS_PREFIX}-radioGroup-checked`,
    DISABLED: `${BASE_CLASS_PREFIX}-radioGroup-disabled`,
} as const;

const strings = {
    DIRECTION_SET: ['horizontal', 'vertical'],
    DEFAULT_DIRECTION: 'horizontal',
    MODE: ['advanced', ''],
    TYPE_DEFAULT: 'default',
    TYPE_BUTTON: 'button',
    TYPE_CARD: 'card',
    TYPE_PURECARD: 'pureCard',
    BUTTON_SIZE: ['middle', 'small', 'large'],
} as const;

const numbers = {};

export { radioClasses, radioGroupClasses, strings, numbers };

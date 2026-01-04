import { BASE_CLASS_PREFIX } from '../base/constants';

const checkboxClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-checkbox`,
    INNER: `${BASE_CLASS_PREFIX}-checkbox-inner`,
    TEXT: `${BASE_CLASS_PREFIX}-checkbox-text`,
    INPUT: `${BASE_CLASS_PREFIX}-checkbox-input`,
    CHECKED: `${BASE_CLASS_PREFIX}-checkbox-checked`,
    DISABLED: `${BASE_CLASS_PREFIX}-checkbox-disabled`,
    BUTTON: `${BASE_CLASS_PREFIX}-checkbox-button`,
    WRAPPER: '',
};

const checkboxGroupClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-checkboxGroup`,
    INNER: `${BASE_CLASS_PREFIX}-checkboxGroup-inner`,
    TEXT: `${BASE_CLASS_PREFIX}-checkboxGroup-text`,
    INPUT: `${BASE_CLASS_PREFIX}-checkboxGroup-input`,
    CHECKED: `${BASE_CLASS_PREFIX}-checkboxGroup-checked`,
    DISABLED: `${BASE_CLASS_PREFIX}-checkboxGroup-disabled`
};

const strings = {
    DIRECTION_SET: ['horizontal', 'vertical'],
    TYPE_DEFAULT: 'default',
    TYPE_CARD: 'card',
    TYPE_PURECARD: 'pureCard',
    DEFAULT_DIRECTION: 'vertical'
} as const;


const numbers = {};

export { checkboxClasses, checkboxGroupClasses, strings, numbers };

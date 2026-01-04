import {
    BASE_CLASS_PREFIX
} from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX }-feedback`,
} as const;

const strings = {
    MODE: ['modal', 'popup'],
    TYPE: ['text', 'emoji', 'radio', 'checkbox', 'custom'],
    Emoji: {
        bad: '😞',
        normal: '😐',
        good: '😃'
    }
} as const;

export {
    cssClasses,
    strings
};
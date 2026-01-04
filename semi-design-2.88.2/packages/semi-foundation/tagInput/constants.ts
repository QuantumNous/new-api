import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-tagInput`,
} as const;

const strings = {
    SIZE_SET: ['large', 'default', 'small'],
    STATUS: ["success", "default", "error", "warning"],
} as const;

export {
    cssClasses,
    strings
};

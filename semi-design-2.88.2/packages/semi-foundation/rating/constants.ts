import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-rating`,
};

const strings = {
    SIZE_SET: ['default', 'small']
} as const;

export { cssClasses, strings };
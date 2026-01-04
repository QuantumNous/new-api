import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-icon`,
};

const strings = {
    SIZE: ['extra-small', 'small', 'default', 'large', 'extra-large', 'custom'],
    // use in svg xhref. No need to respond to the change of prefixCls, always constant
    ICON_PREFIX: 'semi-icon-',
};

const numbers = {};

export { cssClasses, strings, numbers };

import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-switch`,
    FOCUS: `${BASE_CLASS_PREFIX}-switch-focus`,
    LARGE: `${BASE_CLASS_PREFIX}-switch-large`,
    SMALL: `${BASE_CLASS_PREFIX}-switch-small`,
    CHECKED: `${BASE_CLASS_PREFIX}-switch-checked`,
    DISABLED: `${BASE_CLASS_PREFIX}-switch-disabled`,
    ACTIVE: `${BASE_CLASS_PREFIX}-switch-active`,
    KNOB: `${BASE_CLASS_PREFIX}-switch-knob`,
    NATIVE_CONTROL: `${BASE_CLASS_PREFIX}-switch-native-control`,
    CHECKED_TEXT: `${BASE_CLASS_PREFIX}-switch-checked-text`,
    UNCHECKED_TEXT: `${BASE_CLASS_PREFIX}-switch-unchecked-text`,
    LOADING_SPIN: `${BASE_CLASS_PREFIX}-switch-loading-spin`,
    LOADING: `${BASE_CLASS_PREFIX}-switch-loading`,
};

const strings = {
    SIZE_MAP: ['default', 'small', 'large'],
} as const;

export { cssClasses, strings };

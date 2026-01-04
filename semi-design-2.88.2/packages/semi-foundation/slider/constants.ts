import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-slider`,
    DISABLED: `${BASE_CLASS_PREFIX}-slider-disabled`,
    VERTICAL: `${BASE_CLASS_PREFIX}-slider-vertical`,
    TRACK: `${BASE_CLASS_PREFIX}-slider-track`,
    DOTS: `${BASE_CLASS_PREFIX}-slider-dots`,
    MARKS: `${BASE_CLASS_PREFIX}-slider-marks`,
    HANDLE: `${BASE_CLASS_PREFIX}-slider-handle`,
    HANDLE_DOT: `${BASE_CLASS_PREFIX}-slider-handle-dot`,
};

const strings = {
    SIZE: ['small', 'large', 'default'],
    POSITION: ['top', 'bottom'],
    OPTIONS: ['children', 'option'],
};

export { cssClasses, strings };

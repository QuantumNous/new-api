import { VALIDATE_STATUS, BASE_CLASS_PREFIX } from '../base/constants';
import { strings as inputStrings } from '../input/constants';

const TYPE_TIME_PICKER = 'time' as const;
const TYPE_TIME_RANGE_PICKER = 'timeRange' as const;
const DEFAULT_RANGE_SEPARATOR = ' ~ ' as const;
const DEFAULT_MULTIPLE_SEPARATOR = ',' as const;

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-timepicker`,
    RANGE_PICKER: `${BASE_CLASS_PREFIX}-timepicker-range-panel`,
    RANGE_PANEL_LISTS: `${BASE_CLASS_PREFIX}-timepicker-lists`,
};

const strings = {
    TYPES: [TYPE_TIME_PICKER, TYPE_TIME_RANGE_PICKER],
    TYPE_TIME_PICKER,
    TYPE_TIME_RANGE_PICKER,
    DEFAULT_TYPE: TYPE_TIME_PICKER,
    DEFAULT_RANGE_SEPARATOR,
    DEFAULT_MULTIPLE_SEPARATOR,
    SIZE: inputStrings.SIZE,
    DEFAULT_FORMAT: 'HH:mm:ss',
    DEFAULT_FORMAT_A: 'a h:mm:ss',
    STATUS: VALIDATE_STATUS,
    DEFAULT_POSITION: {
        [TYPE_TIME_PICKER]: 'bottomLeft',
        [TYPE_TIME_RANGE_PICKER]: 'bottomLeft',
    },
};

const numbers = {};

export { cssClasses, strings, numbers };

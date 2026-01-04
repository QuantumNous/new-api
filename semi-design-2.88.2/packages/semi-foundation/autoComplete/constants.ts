import { strings as tooltipStrings } from '../tooltip/constants';
import { BASE_CLASS_PREFIX, VALIDATE_STATUS } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-autocomplete`,
    PREFIX_OPTION: `${BASE_CLASS_PREFIX}-autocomplete-option`,
    PREFIX_GROUP: `${BASE_CLASS_PREFIX}-autocomplete-group`,
};

const strings = {
    SIZE: ['small', 'large', 'default'],
    POSITION: tooltipStrings.POSITION_SET,
    OPTIONS: ['children', 'value'],
    STATUS: VALIDATE_STATUS,
} as const;

export { cssClasses, strings };

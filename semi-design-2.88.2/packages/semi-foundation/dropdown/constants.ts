import { strings as tooltipStrings } from '../tooltip/constants';
import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-dropdown`,
    SELECTED: `${BASE_CLASS_PREFIX}-dropdown-item-selected`,
    DISABLED: `${BASE_CLASS_PREFIX}-dropdown-item-disabled`,
};

const strings = {
    POSITION_SET: tooltipStrings.POSITION_SET,
    TRIGGER_SET: ['hover', 'focus', 'click', 'custom', 'contextMenu'],
    DEFAULT_LEAVE_DELAY: 100,
    ITEM_TYPE: ['primary', 'secondary', 'tertiary', 'warning', 'danger'],
};

const numbers = {
    SPACING: 4,
    NESTED_SPACING: 2,
};

export { cssClasses, strings, numbers };

import { VALIDATE_STATUS, BASE_CLASS_PREFIX } from '../base/constants';
import { numbers as popoverNumber, strings as POPOVER_STRINGS } from '../popover/constants';

const dayItemClasses = {
    DAY_TODAY: `${BASE_CLASS_PREFIX}-datepicker-day-today`,
    DAY_IN_RANGE: `${BASE_CLASS_PREFIX}-datepicker-day-inrange`,
    DAY_HOVER: `${BASE_CLASS_PREFIX}-datepicker-day-inhover`,
    DAY_SELECTED: `${BASE_CLASS_PREFIX}-datepicker-day-selected`,
    DAY_SELECTED_START: `${BASE_CLASS_PREFIX}-datepicker-day-selected-start`,
    DAY_SELECTED_END: `${BASE_CLASS_PREFIX}-datepicker-day-selected-end`,
    DAY_DISABLED: `${BASE_CLASS_PREFIX}-datepicker-day-disabled`,
    DAY_HOVER_DAY: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday`,
    DAY_HOVER_DAY_OFFSET: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday-offset`,
    DAY_IN_OFFSET_RANGE: `${BASE_CLASS_PREFIX}-datepicker-day-inoffsetrange`,
    DAY_SELECTED_RANGE_HOVER: `${BASE_CLASS_PREFIX}-datepicker-day-selectedrange-hover`,
    DAY_OFFSET_RANGE_START: `${BASE_CLASS_PREFIX}-datepicker-day-offsetrange-start`,
    DAY_OFFSET_RANGE_END: `${BASE_CLASS_PREFIX}-datepicker-day-offsetrange-end`,
    DAY_SELECTED_START_AFTER_HOVER: `${BASE_CLASS_PREFIX}-datepicker-day-selected-start-afterhover`,
    DAY_SELECTED_END_BEFORE_HOVER: `${BASE_CLASS_PREFIX}-datepicker-day-selected-end-beforehover`,
    DAY_HOVER_DAY_BEFORE_RANGE: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday-beforerange`,
    DAY_HOVER_DAY_AFTER_RANGE: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday-afterrange`,
    DAY_HOVER_DAY_IN_RANGE: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday-inrange`,
    DAY_HOVER_DAY_AROUND_SINGLE_SELECTED: `${BASE_CLASS_PREFIX}-datepicker-day-hoverday-around-singleselected`,
} as const;

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-datepicker`,
    NAVIGATION: `${BASE_CLASS_PREFIX}-datepicker-navigation`,
    PANEL_YAM: `${BASE_CLASS_PREFIX}-datepicker-panel-yam`,
    MONTH: `${BASE_CLASS_PREFIX}-datepicker-month`,
    WEEKDAY: `${BASE_CLASS_PREFIX}-datepicker-weekday`,
    WEEKS: `${BASE_CLASS_PREFIX}-datepicker-weeks`,
    WEEK: `${BASE_CLASS_PREFIX}-datepicker-week`,
    DAY: `${BASE_CLASS_PREFIX}-datepicker-day`,
    ...dayItemClasses,
} as const;

const formatToken = {
    FORMAT_FULL_DATE: 'yyyy-MM-dd',
    FORMAT_TIME_PICKER: 'HH:mm:ss',
    FORMAT_DATE_TIME: 'yyyy-MM-dd HH:mm:ss',
    FORMAT_YEAR_MONTH: 'yyyy-MM',
} as const;

const strings = {
    DEFAULT_SEPARATOR_MULTIPLE: ',',
    DEFAULT_SEPARATOR_RANGE: ' ~ ',
    SIZE_SET: ['small', 'default', 'large'],
    TYPE_SET: ['date', 'dateRange', 'year', 'month', 'monthRange', 'dateTime', 'dateTimeRange'],
    PRESET_POSITION_SET: ['left', 'right', 'top', 'bottom'],
    DENSITY_SET: ['default', 'compact'],
    PANEL_TYPE_LEFT: 'left',
    PANEL_TYPE_RIGHT: 'right',
    STATUS: VALIDATE_STATUS,
    POSITION_SET: POPOVER_STRINGS.POSITION_SET,
    POSITION_INLINE_INPUT: 'leftTopOver',
    ...formatToken,
} as const;

const numbers = {
    WEEK_START_ON: 0, // Take the day of the week as the first day of the week, 0 for Sunday, 1 for Monday, and so on
    WEEK_HEIGHT: 36, // Date per line height 36px
    SPACING: popoverNumber.SPACING, // Floating distance trigger interval
    SPACING_INSET_INPUT: 1,
} as const;

export { cssClasses, strings, numbers };

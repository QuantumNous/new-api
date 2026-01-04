import { addMonths, Locale as dateFnsLocale } from 'date-fns';
import isValidDate from './isValidDate';
import { compatibleParse } from './parser';
import isTimestamp from './isTimestamp';

/**
 * get left panel picker date and right panel picker date
 */
export default function getDefaultPickerDate(options: GetDefaultPickerValueDateOptions) {
    const { defaultPickerValue, format, dateFnsLocale } = options;
    let nowDate = Array.isArray(defaultPickerValue) ? defaultPickerValue[0] : defaultPickerValue;
    let nextDate = Array.isArray(defaultPickerValue) ? defaultPickerValue[1] : undefined;

    switch (true) {
        case isValidDate(nowDate):
            break;
        case isTimestamp(nowDate):
            nowDate = new Date(nowDate);
            break;
        case typeof nowDate === 'string':
            nowDate = compatibleParse(nowDate as string, format, undefined, dateFnsLocale);
            break;
        default:
            nowDate = new Date();
            break;
    }

    switch (true) {
        case isValidDate(nextDate):
            break;
        case isTimestamp(nextDate):
            nextDate = new Date(nextDate);
            break;
        case typeof nextDate === 'string':
            nextDate = compatibleParse(nextDate as string, format, undefined, dateFnsLocale);
            break;
        default:
            nextDate = addMonths(nowDate as Date, 1);
            break;
    }

    return {
        nowDate: nowDate as Date,
        nextDate: nextDate as Date,
    };
}

type BaseValueType = string | number | Date;

interface GetDefaultPickerValueDateOptions {
    defaultPickerValue?: BaseValueType | BaseValueType[];
    format: string;
    dateFnsLocale: dateFnsLocale
}
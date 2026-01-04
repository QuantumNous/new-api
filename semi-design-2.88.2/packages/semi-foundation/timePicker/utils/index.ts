import { format, parse } from 'date-fns';
import { toNumber } from 'lodash';
import { strings } from '../constants';
import isNullOrUndefined from '../../utils/isNullOrUndefined';
import { zhCN as defaultLocale } from 'date-fns/locale';

/**
 *
 * @param {string|Date|number} input
 * @param {string} formatToken
 * @param {object} dateFnsLocale
 * @returns {Date}
 */
export const parseToDate = (input: string | Date | number, formatToken = strings.DEFAULT_FORMAT, dateFnsLocale = defaultLocale) => {
    if (input instanceof Date) {
        return input;
    } else if (typeof input === 'number') {
        return new Date(toNumber(input));
    } else if (typeof input === 'string') {
        if (input === '') return undefined;

        let curDate = new Date();

        // console.log(input, formatToken);
        curDate = parse(input, formatToken, curDate, { locale: dateFnsLocale });

        // console.log(curDate, formatToken);

        return curDate;
    } else if (typeof input === 'undefined') {
        return undefined;
    }

    return new Date();
};

/**
 *
 * @param {string|Date|number} input
 * @returns {number}
 */
export const parseToTimestamp = (input: string | Date | number, formatToken = strings.DEFAULT_FORMAT, dateFnsLocale = defaultLocale) => Number(parseToDate(input, formatToken, dateFnsLocale));

/**
 *
 * @param {Date|number} dateOrTimestamp
 * @param {string} formatToken
 * @returns {string}
 */
export const formatToString = (dateOrTimestamp: Date | number, formatToken = strings.DEFAULT_FORMAT, dateFnsLocale = defaultLocale) => format(dateOrTimestamp, formatToken, { locale: dateFnsLocale });

export const hourIsDisabled = (disabledHours: () => boolean, hour: number) => {
    if (typeof disabledHours === 'function') {
        const disabledOptions = disabledHours();

        if (
            Array.isArray(disabledOptions) &&
            !isNullOrUndefined(hour) &&
            disabledOptions.some(v => toNumber(v) === toNumber(hour))
        ) {
            return true;
        }
    }

    return false;
};

export const minuteIsDisabled = (disabledMinutes: (hour: number) => number[], hour: number, minute: number) => {
    if (typeof disabledMinutes === 'function') {
        const disabledOptions = disabledMinutes(hour);

        if (
            Array.isArray(disabledOptions) &&
            !isNullOrUndefined(hour) &&
            !isNullOrUndefined(minute) &&
            disabledOptions.some(v => toNumber(v) === toNumber(minute))
        ) {
            return true;
        }
    }

    return false;
};

export const secondIsDisabled = (disabledSeconds: (hour: number, minute: number) => number[], hour: number, minute: number, second: number) => {
    if (typeof disabledSeconds === 'function') {
        const disabledOptions = disabledSeconds(hour, minute);

        if (
            Array.isArray(disabledOptions) &&
            !isNullOrUndefined(hour) &&
            !isNullOrUndefined(minute) &&
            !isNullOrUndefined(second) &&
            disabledOptions.some(v => toNumber(v) === toNumber(second))
        ) {
            return true;
        }
    }

    return false;
};

export const transformToArray = (value: any) => {
    if (!Array.isArray(value)) {
        return [];
    } else {
        return [...value];
    }
};

/**
 * Determine whether the time length is the same as the format
 * e.g.
 *  format      | time      | return
 *  HH:mm       | 12:00     | true
 *  HH:mm:ss    | 12:00:00  | true
 *  yyyy HH:mm  | 2021 12:00| true
 *  HH          | 1         | false
 *  HH:mm       | 12:0      | false
 *  HH          | 1         | false
 *  HH:mm:ss    | 12:00:0   | false
 * @param {String} time  e.g. 12:0
 * @param {String} formatToken e.g. HH:mm
 * @returns {Boolean}
 */
export const isTimeFormatLike = (time: string, formatToken: string) => {
    let isLike = true;
    const dateFnsSupportFormatCh = 'BDEGHKLMOPQRSTXYabcehimopqstuwxyz'; // dateFns support format character
    const formatSupportChReg = new RegExp(`[${dateFnsSupportFormatCh}]`, 'g');
    const formatNotSupportChReg = new RegExp(`[^${dateFnsSupportFormatCh}]`, 'g');
    const hmsReg = /[H|m|s]{1,2}/;
    const formatSplitted = formatToken.split(formatNotSupportChReg); // => ['HH', 'mm'];
    const timeSeparator = formatToken.replace(formatSupportChReg, ''); // => :
    const timeReg = new RegExp(`[${timeSeparator}]`, 'g'); // => /[:]/g
    const timeSplitted = time.split(timeReg); // => ['12', '0]

    if (formatSplitted.length !== timeSplitted.length) {
        isLike = false;
    } else {
        for (let i = 0, len = timeSplitted.length; i < len; i++) {
            const formatStr = formatSplitted[i];
            const timeStr = timeSplitted[i];
            // Returns false if the current character corresponds to minutes and seconds and the length is less than format
            // when i=1 => '0'.length < 'mm'.length
            if (hmsReg.test(formatStr) && timeStr.length < formatStr.length) {
                isLike = false;
                break;
            }
        }
    }
    return isLike;
};

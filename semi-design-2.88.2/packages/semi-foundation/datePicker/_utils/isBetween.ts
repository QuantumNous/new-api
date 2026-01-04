import { isWithinInterval, parseISO, isEqual, isBefore } from 'date-fns';
import isString from '../../utils/isString';

/**
 * is the date between start and end?(not including start and end)
 *   - if start > end, return false
 * @param {String|Date} day
 * @param {Object} { start: string|Date, end: string|Date}
 * @returns {Boolean}
 */
export default function isBetween(day: string | Date, { start, end }: { start: string | Date; end: string | Date }) {
    const d = isString(day) ? parseISO(day) : day;
    const s = isString(start) ? parseISO(start) : start;
    const e = isString(end) ? parseISO(end) : end;
    return isBefore(s, e) && isWithinInterval(d, { start: s, end: e }) && !isEqual(d, s) && !isEqual(d, e);
}

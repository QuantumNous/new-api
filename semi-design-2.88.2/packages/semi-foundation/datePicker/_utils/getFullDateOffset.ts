import { isFunction } from 'lodash';
import { strings } from '../constants';
import { format } from 'date-fns';

/**
 * Calculate the date string offset from the date
 * @param {*} fn
 * @param {*} date
 */
const getFullDateOffset = (fn: any, date: any) => {
    if (!date) {
        return '';
    }
    const getDate = new Date(date);
    const offsetDate = isFunction(fn) ? fn(getDate) : getDate;
    return format(new Date(offsetDate), strings.FORMAT_FULL_DATE);
};

export default getFullDateOffset;

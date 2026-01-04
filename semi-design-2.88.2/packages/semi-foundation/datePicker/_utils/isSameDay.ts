import { isSameDay as dateFnsIsSameDay, parseISO } from 'date-fns';
import isString from '../../utils/isString';

export default function isSameDay(date: string | Date, dateToCompare: string | Date) {
    const dayOne = isString(date) ? parseISO(date) : date;
    const dayTwo = isString(dateToCompare) ? parseISO(dateToCompare) : dateToCompare;
    return dateFnsIsSameDay(dayOne, dayTwo);
}
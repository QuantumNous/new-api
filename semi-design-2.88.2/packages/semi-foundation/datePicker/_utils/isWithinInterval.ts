import { isWithinInterval as dateFnsIsWithinInterval, parseISO } from 'date-fns';
import isString from '../../utils/isString';

export default function isWithinInterval(day: string | Date, { start, end }: { start: string | Date; end: string | Date }) {
    const d = isString(day) ? parseISO(day) : day;
    const s = isString(start) ? parseISO(start) : start;
    const e = isString(end) ? parseISO(end) : end;
    return dateFnsIsWithinInterval(d, { start: s, end: e });
}
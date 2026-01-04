import isValidDate from './isValidDate';
import isNumber from '../../utils/isNumber';

export default function isTimestamp(ts: any) {
    return isNumber(ts) && isValidDate(new Date(ts));
}

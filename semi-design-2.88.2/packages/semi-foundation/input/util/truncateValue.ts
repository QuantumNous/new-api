import { isFunction } from 'lodash';

export default function truncateValue(options: {
    value: string;
    maxLength: number;
    getValueLength?: (value: string) => number
}): string {
    const { value, maxLength, getValueLength } = options;
    if (isFunction(getValueLength)) {
        let left = 0;
        let right = value.length;
        while (left < right) {
            const mid = left + Math.floor((right - left) / 2);
            const currentValue = value.slice(0, mid + 1);
            if (getValueLength(currentValue) > maxLength) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        return value.slice(0, left);
    } else {
        return value.slice(0, maxLength);
    }
}

/**
 * @file
 * Date-related formatting display method
 */
import { format } from 'date-fns';
import { strings } from '../constants';
import { BaseValueType } from '../foundation';

/**
 * Formats the displayed date text
 * @param {string[]|Date[]} values
 * @param {string} formatToken
 * @param {Object} groupOptions
 * @param {Object} locale
 * @returns {string}
 */
export function formatDateValues(
    values: BaseValueType[],
    formatToken: string,
    {
        groupInnerSeparator = strings.DEFAULT_SEPARATOR_RANGE as string,
        groupSize = 1,
        groupSeparator = strings.DEFAULT_SEPARATOR_MULTIPLE as string,
    } = {},
    locale: any
) {
    let text = '';
    (groupSize <= 0 || typeof groupSize !== 'number') && (groupSize = 1);
    // console.log(values, formatToken, groupInnerSeparator, groupSize, groupSeparator);

    if (Array.isArray(values) && values.length) {
        const groups = [];
        const { length } = values;
        // chunk
        for (let i = 0; i < length; i++) {
            if (i % groupSize === 0) {
                groups.push([]);
            }
            const curArrIdx = Math.floor(i / groupSize);
            groups[curArrIdx].push(values[i]);
        }

        text = groups
            .map(arr =>
                arr
                    .map(v => {
                        if (v) {
                            // console.log(`formatDateValues() -> formatDateValues: ${v}`);
                            return format(v, formatToken, { locale });
                        } else {
                            return '';
                        }
                    })
                    .join(groupInnerSeparator)
            )
            .join(groupSeparator);
    }
    return text;
}
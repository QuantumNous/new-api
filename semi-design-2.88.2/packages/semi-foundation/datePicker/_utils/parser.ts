/**
 * @file
 * Various date-related analysis methods
 */
import { isValid, parseISO, parse, Locale } from 'date-fns';

/**
 * Parsing value to Date object
 */
export function compatibleParse(
    value: string,
    formatToken?: string,
    baseDate?: Date,
    locale?: Locale
): Date | null {
    let result = null;
    if (value) {
        if (formatToken) {
            baseDate = baseDate || new Date();
            result = parse(value, formatToken, baseDate, { locale });
        }
        if (!isValid(result)) {
            result = parseISO(value);
        }
        if (!isValid(result)) {
            result = new Date(Date.parse(value));
        }
        const yearInvalid = isValid(result) && String(result.getFullYear()).length > 4;
        if (!isValid(result) || yearInvalid) {
            result = null;
        }
    }
    return result;
}


/**
 * whether value can be parsed with date-fns `parse`
 * 
 * @example
 * isValueParseValid({ value: '2021-01-01', formatToken: 'yyyy-MM-dd' }); // true
 * isValueParseValid({ value: '2021-01-0', formatToken: 'yyyy-MM-dd' }); // false
 * isValueParseValid({ value: '2021-01', formatToken: 'yyyy-MM-dd' }); // false
 */
export function isValueParseValid(options: {
    value: string;
    formatToken: string;
    baseDate?: Date;
    locale?: Locale
}) {
    const { value, locale, formatToken } = options;
    const baseDate = options.baseDate || new Date();
    const result = parse(value, formatToken, baseDate, { locale });
    return isValid(result);
}

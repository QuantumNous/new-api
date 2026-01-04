import { format as dateFnsFormat, parse as dateFnsParse } from 'date-fns';

/* istanbul ignore next */
const replace = function replace(str, replacements) {
    let _str = str;
    for (const key of Object.keys(replacements)) {
        if (typeof replacements[key] === 'string') {
            _str = _str.replace(key, replacements[key]);
        }
    }

    return _str;
};

/* istanbul ignore next */
export function localeFormat(date, format, locale = {}, options = {}) {
    let str = dateFnsFormat(date, format, options);

    str = replace(str, locale);

    return str;
}

/* istanbul ignore next */
export function localeParse(dateString, format, locale = {}, defaultDate = null, options = {}) {
    // const invertedLocale = invert(locale);

    const _dateString = replace(dateString, locale);

    return dateFnsParse(_dateString, format, defaultDate, options);
}

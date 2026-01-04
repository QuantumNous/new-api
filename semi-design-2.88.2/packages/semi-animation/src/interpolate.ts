/**
 *
 * @param {number|number[]|string|string[]} from
 * @param {number|number[]|string|string[]} to
 * @param {number} ratio
 * @param {Function} [parser]
 * @param {Function} [formatter]
 * @returns {any}
*/

export type FromTo = string | number | (string | number)[];
export type Parser = (value: FromTo) => any;
export type Formatter = (value: any[]) => any;

export default function interpolate(from: FromTo, to: FromTo, ratio = 0, parser: Parser = null, formatter: Formatter = null) {
    if (typeof parser === 'function') {
        from = parser(from);
        to = parser(to);
    }

    if (typeof from === 'string' || typeof from === 'number') {
        from = [parseFloat(from as string)];
    }

    if (typeof to === 'string' || typeof to === 'number') {
        to = [parseFloat(to as string)];
    }

    const result: any[] = [];
    if (Array.isArray(from) && Array.isArray(to)) {
        from.forEach((fromVal, idx) => {
            fromVal = parseFloat(fromVal as string);
            const toVal = parseFloat(to[idx]);

            result.push((toVal - fromVal) * ratio + fromVal);
        });
    }

    if (typeof formatter === 'function') {
        return formatter(result);
    } else {
        return result;
    }
}

/**
 *
 * @param {Function} func
 * @param {number} delay
 */
export default function debounce(func: any, delay = 0) {
    let timeoutId: any;
    return function (...args: any) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}

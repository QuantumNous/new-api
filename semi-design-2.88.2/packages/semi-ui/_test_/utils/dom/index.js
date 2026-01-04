/**
 *
 * @param {HTMLElement} elem
 * @param {string} event
 * @returns {boolean}
 */
export function trigger(elem, event) {
    return elem.dispatchEvent(new Event(event, { bubbles: true, cancelable: true }));
}

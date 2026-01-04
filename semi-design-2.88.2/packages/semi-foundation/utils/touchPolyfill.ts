import warning from './warning';
const touchEventPolyfill = (touch: any, touchEvent: any) => {
    /* Touch is the first point of multi-touch. In order to minimize the change of slider code to support touch,
    some methods that will be used on touchEvent are mounted on the multi-touch Touch object.*/

    // polyfill for firefox
    if (!globalThis.Touch || (!(touch instanceof Touch))) {
        return touch;
    }

    const keysNeedPolyfill = ['stopPropagation', 'preventDefault'];
    keysNeedPolyfill.forEach(key => {
        let value = touchEvent[key];
        if (value) {
            if (typeof value === 'function') {
                // bind 'this' for function of touchEvent running in Touch Point Object
                value = (...args: any) => touchEvent[key](...args);
            }
            if (touch[key]) {
                warning(true, `"The key ${key}" exist in Touch.`);
            } else {
                touch[key] = value;
            }

        }
    });
    return touch;
};

export default touchEventPolyfill;
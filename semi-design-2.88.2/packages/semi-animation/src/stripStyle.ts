export default function stripStyle(style: Record<string, any>) {
    const ret = {};
    for (const key in style) {
        if (!Object.prototype.hasOwnProperty.call(style, key)) {
            continue;
        }
        ret[key] = typeof style[key] === 'number' ? style[key] : style[key].val;
    }
    return ret;
}

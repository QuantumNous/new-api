export default function shallowEqual(a: any, b: any) {
    if (typeof a !== typeof b) {
        return false;
    }
    if (typeof a === 'string' || typeof a === 'number') {
        return a === b;
    }
    let i;
    for (i in a) {
        if (!(i in b)) {
            return false;
        }
    }
    for (i in b) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return i === void 0 ? a === b : true;
}

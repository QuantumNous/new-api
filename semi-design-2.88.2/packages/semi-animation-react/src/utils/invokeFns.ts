export default function invokeFns(fns: any[], args: any[] = []) {
    if (Array.isArray(fns) && fns.length) {
        fns.forEach(fn => {
            if (typeof fn === 'function') {
                fn(...args);
            }
        });
    }
}

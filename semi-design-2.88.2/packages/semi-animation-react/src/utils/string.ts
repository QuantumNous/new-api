export function upperCase(str: string, pos: number) {
    if (typeof str === 'string') {
        return str
            // @ts-ignore
            .split()
            .reduce(
                (total, cur, index) => (pos == null || pos === index ? total + cur.toUpperCase() : total + cur),
                ''
            );
    }
    return str;
}

export function lowerCase(str: string, pos: number) {
    if (typeof str === 'string') {
        return str
            // @ts-ignore
            .split()
            .reduce(
                (total, cur, index) => (pos == null || pos === index ? total + cur.toLowerCase() : total + cur),
                ''
            );
    }
    return str;
}

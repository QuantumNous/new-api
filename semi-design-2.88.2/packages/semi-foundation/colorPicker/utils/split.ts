const split = (str: string, mode: 'rgba' | 'hsva') => {
    // 12,32,43 => [12,32,43]
    const reg = /^\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,?\s*([\d.]*)\s*$/;
    const res = str.match(reg);
    const result: number[] = [];
    result[0] = Number(res?.[1]);
    result[1] = Number(res?.[2]);
    result[2] = Number(res?.[3]);
    result[3] = Number((res?.[4] === undefined || res?.[4] === '') ? 1 : res?.[4]);

    const check = (a: number, max: number) => {
        return !(isNaN(a) || a < 0 || a > max);
    };

    const ok = check(result[0], mode === 'rgba' ? 255 : 360)
        && check(result[1], mode === 'rgba' ? 255 : 100)
        && check(result[2], mode === 'rgba' ? 255 : 100)
        && check(result[3], 1);
    if (ok) {
        if (mode === 'rgba') {
            return {
                r: result[0],
                g: result[1],
                b: result[2],
                a: result[3]
            };
        } else {
            return {
                h: result[0],
                s: result[1],
                v: result[2],
                a: result[3]
            };
        }
    } else {
        return false;
    }
};

export default split;

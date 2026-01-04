interface GetUuidShortOptions {
    prefix?: string;
    length?: number
}

/**
 * Get a random id with prefix, it not strictly guarantee id uniqueness
 *
 * Note: the return value of getUuid is too long, we need a short one
 *
 * @example
 * getUuidShort({ prefix: 'semi' }) => 'semi-46dinzc'
 * getUuidShort({ prefix: '' }) => '0eer2i0'
 * getUuidShort({ prefix: 'semi', length: 4 }) => 'semi-8jts'
 */
function getUuidShort(options: GetUuidShortOptions = {}) {
    const { prefix = '', length = 7 } = options;
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ';
    const total = characters.length;
    let randomId = '';
    for (let i = 0; i < length; i++) {
        const random = Math.floor(Math.random() * total);
        randomId += characters.charAt(random);
    }

    return prefix ? `${prefix}-${randomId}` : randomId;
}

function getFillColor(fill: string | string[] | undefined, num: number) {
    if (typeof fill === 'string') {
        return new Array(num).fill(fill);
    } else if (Array.isArray(fill)) {
        const fillLength = fill.length;
        let result: string[] = fill;
        if (fillLength < num) {
            let i = 0;
            result = [];
            while (i < num) {
                result.push(fill[i % fillLength]);
                i++;
            }
            return result;
        } else if (fillLength > num) {
            result = fill.slice(0, num);
        }
        if (num === 4) {
            return result.reverse();
        } 
        return result;
    }
    if (num === 2) {
        return [
            'rgba(166,71,255)',
            'currentColor'
        ];
    }
    return [
        'rgba(233,69,255)',
        'rgba(166,71,255)',
        'rgba(107,97,255)',
        'rgba(46,140,255)',  
    ];
}

export { getUuidShort, getFillColor };
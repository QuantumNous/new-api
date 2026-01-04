import shouldUseBezier from './shouldUseBezier';

/**
 * usage assumption: currentStyle values have already been rendered but it says
 * nothing of whether currentStyle is stale (see unreadPropStyle)
 *
 * @param {object} currentStyle
 * @param {object} style
 * @param {object} currentVelocity
 * @param {number} startTime
 * @param {number} nowTime
 *
 * @returns {boolean}
 */
export default function shouldStopAnimation(currentStyle: Record<string, any>, style: Record<string, any>, currentVelocity: Record<string, any>, startTime: number, nowTime: number) {
    for (const key of Object.keys(style)) {
        const styleValue = style[key];
        const value = typeof styleValue === 'number' ? styleValue : styleValue.val;

        if (typeof styleValue === 'object' && styleValue.done) {
            continue;
        }

        if (shouldUseBezier(styleValue) && startTime && nowTime && styleValue.duration) {
            if (styleValue.duration + startTime <= nowTime || value !== currentStyle[key]) {
                return false;
            }
        } else if (typeof currentVelocity[key] === 'number' && currentVelocity[key] !== 0) {
            return false;
        }

        // stepper will have already taken care of rounding precision errors, so
        // won't have such thing as 0.9999 !=== 1
        if (currentStyle[key] !== value) {
            return false;
        }
    }

    return true;
}

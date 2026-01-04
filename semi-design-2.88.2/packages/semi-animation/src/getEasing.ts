import bezier from 'bezier-easing';

export type BezierArgs = [number, number, number, number];

function minMax(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
}

function parseEasingParameters(string: string) {
    const match = /\(([^)]+)\)/.exec(string);
    return match ? match[1].split(',').map(p => parseFloat(p)) : [];
}

// Elastic easing adapted from jQueryUI http://api.jqueryui.com/easings/
function elastic(amplitude = 1, period = 0.5) {
    const a = minMax(amplitude, 1, 10);
    const p = minMax(period, 0.1, 2);
    return (t: number) => (t === 0 || t === 1 ?
        t :
        -a *
        Math.pow(2, 10 * (t - 1)) *
        Math.sin(((t - 1 - (p / (Math.PI * 2)) * Math.asin(1 / a)) * (Math.PI * 2)) / p));
}

// anime.js/src/index.js
export const easingMap = (() => {
    const names = ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic'];

    // Approximated Penner equations http://matthewlein.com/ceaser/

    const curves = {
        In: [
            [0.55, 0.085, 0.68, 0.53] /* inQuad */,
            [0.55, 0.055, 0.675, 0.19] /* inCubic */,
            [0.895, 0.03, 0.685, 0.22] /* inQuart */,
            [0.755, 0.05, 0.855, 0.06] /* inQuint */,
            [0.47, 0.0, 0.745, 0.715] /* inSine */,
            [0.95, 0.05, 0.795, 0.035] /* inExpo */,
            [0.6, 0.04, 0.98, 0.335] /* inCirc */,
            [0.6, -0.28, 0.735, 0.045] /* inBack */,
            elastic /* inElastic */,
        ],
        Out: [
            [0.25, 0.46, 0.45, 0.94] /* outQuad */,
            [0.215, 0.61, 0.355, 1.0] /* outCubic */,
            [0.165, 0.84, 0.44, 1.0] /* outQuart */,
            [0.23, 1.0, 0.32, 1.0] /* outQuint */,
            [0.39, 0.575, 0.565, 1.0] /* outSine */,
            [0.19, 1.0, 0.22, 1.0] /* outExpo */,
            [0.075, 0.82, 0.165, 1.0] /* outCirc */,
            [0.175, 0.885, 0.32, 1.275] /* outBack */,
            (a: number, p: number) => (t: number) => 1 - elastic(a, p)(1 - t) /* outElastic */,
        ],
        InOut: [
            [0.455, 0.03, 0.515, 0.955] /* inOutQuad */,
            [0.645, 0.045, 0.355, 1.0] /* inOutCubic */,
            [0.77, 0.0, 0.175, 1.0] /* inOutQuart */,
            [0.86, 0.0, 0.07, 1.0] /* inOutQuint */,
            [0.445, 0.05, 0.55, 0.95] /* inOutSine */,
            [1.0, 0.0, 0.0, 1.0] /* inOutExpo */,
            [0.785, 0.135, 0.15, 0.86] /* inOutCirc */,
            [0.68, -0.55, 0.265, 1.55] /* inOutBack */,
            (a: number, p: number) => (t: number) => (
                t < 0.5 ?
                    elastic(a, p)(t * 2) / 2 :
                    1 - elastic(a, p)(t * -2 + 2) / 2
            ) /* inOutElastic */,
        ],
    };

    const eases = {
        linear: [0.25, 0.25, 0.75, 0.75],
    };

    for (const coords of Object.keys(curves)) {
        curves[coords].forEach((ease: any, i: string | number) => {
            eases['ease' + coords + names[i]] = ease;
        });
    }

    return eases;
})();

/**
 * get easing function
 * @param {string|Function} easing
 * @returns {Function}
 */
export default function getEasing(easing: string) {
    if (typeof easing === 'function') {
        return easing;
    }

    if (!easing || typeof easing !== 'string') {
        easing = 'linear';
    } else {
        easing = easing.trim();
    }

    let name = easing.split('(')[0];
    const args = parseEasingParameters(easing);
    let ease;

    if (name === 'cubic-bezier' || name === 'cubicBezier') {
        return bezier(...(args.length ? args : easingMap.linear) as BezierArgs);
    } else {
        if (!name || typeof name !== 'string' || (typeof name === 'string' && easingMap[name] == null)) {
            name = 'linear';
        }

        ease = easingMap[name];

        if (typeof ease === 'function') {
            return ease(...args);
        } else if (args.length) {
            return bezier(...args as BezierArgs);
        } else {
            return bezier(...ease as BezierArgs);
        }
    }
}

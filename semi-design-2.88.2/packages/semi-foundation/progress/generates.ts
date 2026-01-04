import { strings } from './constants';

// type ColorType = 'Hex' | 'Hsl' | 'Hsla' | 'Rgb' | 'Rgba' | 'Semi Design Tokens';

type Generate = {
    startColor: string;
    endColor: string;
    size: number
};

type StrokeSet = { percent: number; color: string };

type StrokeArr = Array<StrokeSet>;

function generateColor(s: StrokeArr, percent: number, gradient: boolean): string | undefined {
    try {
        const gradientColorArr = generate(s, percent, gradient);
        if (gradientColorArr.length !== 0) return gradientColorArr;
    } catch (e) {
        return undefined;
    }
    return undefined;
}

function generate(s: StrokeArr, percent: number, gradient: boolean): string | undefined {
    s.sort((a, b) => a.percent - b.percent);
    if (s[0].percent > percent) {
        return strings.STROKE_DEFAULT;
    }
    const endS = s[s.length - 1];
    if (endS.percent < percent) {
        return formatToHex(endS.color);
    }
    for (const [index, item] of s.entries()) {
        if (item.percent === percent) {
            return formatToHex(item.color);
        }
        if (percent > item.percent) continue;
        const oldItem = s[index - 1];
        if (!gradient) {
            return formatToHex(oldItem.color);
        }
        return generateGradients(
            {
                startColor: formatToHex(oldItem.color),
                endColor: formatToHex(item.color),
                size: item.percent - oldItem.percent - 1,
            },
            percent - oldItem.percent - 1
        ) as string;
    }
    return undefined;
}

function generateGradients(g: Generate, index: number | undefined): Array<string> | string {
    const { startColor, endColor, size } = g;
    const sA = startColor.split('');
    const eA = endColor.split('');
    const rC = [parseInt(`${sA[1]}${sA[2]}`, 16), parseInt(`${eA[1]}${eA[2]}`, 16)];
    const gC = [parseInt(`${sA[3]}${sA[4]}`, 16), parseInt(`${eA[3]}${eA[4]}`, 16)];
    const bC = [parseInt(`${sA[5]}${sA[6]}`, 16), parseInt(`${eA[5]}${eA[6]}`, 16)];
    const aC = [parseInt(`${sA[7]}${sA[8]}`, 16), parseInt(`${eA[7]}${eA[8]}`, 16)];
    const rStep = (rC[0] - rC[1]) / (size + 1);
    const gStep = (gC[0] - gC[1]) / (size + 1);
    const bStep = (bC[0] - bC[1]) / (size + 1);
    const aStep = (aC[0] - aC[1]) / (size + 1);
    function tHex(i: number) {
        const rS = Math.round(rC[0] - rStep * (i + 1)).toString(16);
        const gS = Math.round(gC[0] - gStep * (i + 1)).toString(16);
        const bS = Math.round(bC[0] - bStep * (i + 1)).toString(16);
        const h = `${padTwo(rS)}${padTwo(gS)}${padTwo(bS)}`;
        const t = Math.floor(aStep * (i + 1) + aC[1]).toString(16);
        return toHex.Hex(`#${h}`, t);
    }
    function padTwo(s: string) {
        if (s.length === 1) {
            return `0${s}`;
        }
        if (s.length === 0) {
            return '00';
        }
        return s;
    }
    if (typeof index === 'undefined') {
        const gradientColorArr = [startColor];
        for (let i = 0; i < size; i += 1) {
            gradientColorArr.push(tHex(i));
        }
        return gradientColorArr;
    }
    return tHex(index);
}

// Resolve the colour type contained within `ColorType` to Hex
function formatToHex(color: string): string | undefined {
    color = color.trim().toLowerCase();
    // Hex
    if (REG_S.hex.test(color)) {
        return toHex.Hex(color, undefined);
    }
    // Hsl or Hsla
    if (REG_S.hslA.test(color)) {
        return toHex.Hex(toHex.HslA(color), undefined);
    }
    // Rgb or Rgba
    if (REG_S.rgbA.test(color)) {
        return toHex.Hex(toHex.RgbA(color), undefined);
    }
    // Semi Design Tokens
    if (REG_S.semiDesignTokens.test(color)) {
        if (SEMI_DESIGN_TOKENS.ALONG.indexOf(color) !== -1) {
            return toHex.SemiDesignToken(color);
        }
        if (SEMI_DESIGN_TOKENS.SEQUENCE.indexOf(color) !== -1) {
            return toHex.SemiDesignToken(`${color}-5`);
        }
        return toHex.SemiDesignToken(`${color}`);
    }
    return undefined;
}

const toHex = {
    Hex(color: string, transparency: string | undefined): string {
        color = color.replace('#', '');
        if (color.length === 8) return `#${color}`;
        if (color.length === 6) return `#${color}${transparency || 'ff'}`;
        if (color.length === 3) {
            color = color
                .split('')
                .map(c => c + c)
                .join('');
        }
        return `#${color}${transparency || 'ff'}`;
    },
    SemiDesignToken(color: string): string | undefined {
        // ! Only produces effects when used, the conditions for running need to occur after the real DOM is rendered
        if (typeof window === 'undefined') {
            return undefined;
        }
        const variable = getComputedStyle(document.body).getPropertyValue(`--semi-${color}`);
        if (variable === '') return undefined;
        const rgba = `rgba(${variable}, 1)`;
        return toHex.RgbA(rgba);
    },
    HslA(color: string): string {
        const hsla = REG_S.hslA.exec(color);
        const h = parseInt(hsla[2]);
        const s = parseInt(hsla[3]) / 100;
        const l = parseInt(hsla[4]) / 100;
        const a = hsla[5];
        const c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
            m = l - c / 2;
        let r: string | number = 0,
            g: string | number = 0,
            b: string | number = 0;
        if (0 <= h && h < 60) {
            r = c;
            g = x;
            b = 0;
        } else if (60 <= h && h < 120) {
            r = x;
            g = c;
            b = 0;
        } else if (120 <= h && h < 180) {
            r = 0;
            g = c;
            b = x;
        } else if (180 <= h && h < 240) {
            r = 0;
            g = x;
            b = c;
        } else if (240 <= h && h < 300) {
            r = x;
            g = 0;
            b = c;
        } else if (300 <= h && h < 360) {
            r = c;
            g = 0;
            b = x;
        }
        r = Math.round((r + m) * 255).toString(16);
        g = Math.round((g + m) * 255).toString(16);
        b = Math.round((b + m) * 255).toString(16);
        return toHex.utils.pAL(r, g, b, a);
    },
    RgbA(color: string): string {
        const rgba = REG_S.rgbA.exec(color);
        const r = parseInt(rgba[2], 10).toString(16),
            g = parseInt(rgba[3], 10).toString(16),
            b = parseInt(rgba[4], 10).toString(16),
            a = rgba[5];
        return toHex.utils.pAL(r, g, b, a);
    },
    utils: {
        pAL(r: string, g: string, b: string, a: string) {
            if (r.length == 1) r = '0' + r;
            if (g.length == 1) g = '0' + g;
            if (b.length == 1) b = '0' + b;
            if (typeof a !== 'undefined') {
                a = Math.round(parseInt(a) * 255).toString(16);
                if (a.length == 1) a = '0' + a;
                return '#' + r + g + b + a;
            }
            return '#' + r + g + b;
        },
    },
};

const REG_S = {
    hex: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    hslA: /(hsl)a?\(\s*?(\d+),?\s*?(\d+)%,?\s*?(\d+)%,?\s*?\/?(\s*?[\d.]+)?\s*?\)/,
    rgbA: /(rgb)a?\(\s*?(\d+),?\s*?(\d+),?\s*?(\d+),?\s*?\/?(\s*?[\d.]+)?\s*?\)/,
    semiDesignTokens: /(\w+)?-?(\w+)-?(\d)?/,
};

// From src/components/palette.js
const SEMI_DESIGN_TOKENS = {
    // No sequence
    ALONG: ["black", "white"],
    // Sequence: 0-9
    SEQUENCE: [
        "amber",
        "blue",
        "cyan",
        "green",
        "grey",
        "indigo",
        "light-blue",
        "light-green",
        "lime",
        "orange",
        "pink",
        "purple",
        "red",
        "teal",
        "violet",
        "yellow"
    ]
};

export { generateColor, StrokeArr };

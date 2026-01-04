export interface HsvColor {
    h: number;
    s: number;
    v: number
}

export interface HsvaColor extends HsvColor {
    a: number
}


export interface RgbColor {
    r: number;
    g: number;
    b: number
}

export interface RgbaColor extends RgbColor {
    a: number
}

export interface HslColor {
    h: number;
    s: number;
    l: number
}

export interface HslaColor extends HslColor {
    a: number
}

export interface HsvColor {
    h: number;
    s: number;
    v: number
}

export interface HsvaColor extends HsvColor {
    a: number
}

export type ObjectColor = RgbColor | HslColor | HsvColor | RgbaColor | HslaColor | HsvaColor;

export type AnyColor = string | ObjectColor;

export interface ColorModel<T extends AnyColor> {
    defaultColor: T;
    toHsva: (defaultColor: T) => HsvaColor;
    fromHsva: (hsva: HsvaColor) => T;
    equal: (first: T, second: T) => boolean
}

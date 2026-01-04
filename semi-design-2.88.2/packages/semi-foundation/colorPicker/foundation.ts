import { HsvaColor, RgbaColor } from './interface';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import {
    hexToHsva,
    hexToRgba,
    hsvaToHex,
    hsvaToHslaString,
    hsvaToHslString,
    hsvaToRgba, rgbaStringToHsva, rgbaStringToRgba,
    rgbaToHex,
    rgbaToHsva,
} from './utils/convert';


export type ColorValue = {
    hsva: HsvaColor;
    rgba: RgbaColor;
    hex: string
}
export interface ColorPickerProps {
    eyeDropper?: boolean;
    defaultValue?: ColorValue;
    value?: ColorValue;
    onChange: (value: ColorValue) => void;
    alpha: boolean;
    width?: number;
    height?: number;
    defaultFormat: 'hex' | 'rgba' | 'hsva'
}

export interface ColorPickerState {
    currentColor: ColorValue
}


export interface ColorPickerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyChange: (value: ColorValue) => void
}


class ColorPickerFoundation extends BaseFoundation<ColorPickerAdapter<ColorPickerProps, ColorPickerState>, ColorPickerProps, ColorPickerState> {

    constructor(adapter: ColorPickerAdapter<ColorPickerProps, ColorPickerState>) {
        super({
            ...adapter
        });
    }

    static hsvaToRgba = hsvaToRgba
    static rgbaToHsva = rgbaToHsva
    static rgbaToHex = rgbaToHex
    static hsvaToHex = hsvaToHex
    static hexToRgba = hexToRgba
    static hexToHsva = hexToHsva
    static hsvaToHslaString = hsvaToHslaString
    static hsvaToHslString = hsvaToHslString
    static rgbaStringToHsva = rgbaStringToHsva
    static rgbaStringToRgba = rgbaStringToRgba


    handleChangeH = (currentColor: ColorValue, newH: number) => {

        const hsva = {
            ...currentColor.hsva,
            h: newH
        };
        const rgba = hsvaToRgba(hsva);
        const hex = hsvaToHex(hsva);

        const newCurrentColor = {
            rgba,
            hsva,
            hex
        };

        this._adapter.notifyChange(newCurrentColor);
        if (!this.getProp("value")) {
            this._adapter.setState({ currentColor: newCurrentColor });
        }

    }


    handleChangeA = (currentColor: ColorValue, newAlpha: number) => {
        let alpha = this._adapter.getProp('alpha');
        if (!alpha) {
            newAlpha = 1;
        }
        const rgba = {
            ...currentColor.rgba,
            a: newAlpha
        };
        const hex = rgbaToHex(rgba);
        currentColor = {
            rgba,
            hex: alpha ? hex : hex.slice(0, 7),
            hsva: {
                ...currentColor.hsva,
                a: newAlpha
            }
        };
        this._adapter.notifyChange(currentColor);
        if (!this.getProp("value")) {
            this._adapter.setState({ currentColor: currentColor });
        }

    }

    getCurrentColor = ()=>{

        const value = this.getProp("value");
        const currentColor = this.getState("currentColor");
        return value || currentColor;
    }

    handleChange = (color: HsvaColor|RgbaColor|string, format: 'hex'|'rgba'|'hsva')=>{
        let currentColor;

        if (format === 'hsva') {
            currentColor = {
                hsva: color as HsvaColor,
                rgba: ColorPickerFoundation.hsvaToRgba(color as HsvaColor),
                hex: ColorPickerFoundation.hsvaToHex(color as HsvaColor)
            };
        } else if (format === 'rgba') {
            currentColor = {
                rgba: color as RgbaColor,
                hsva: ColorPickerFoundation.rgbaToHsva(color as RgbaColor),
                hex: ColorPickerFoundation.rgbaToHex(color as RgbaColor)
            };
        } else if (format === 'hex') {
            currentColor = {
                hex: color as string,
                hsva: ColorPickerFoundation.hexToHsva(color as string),
                rgba: ColorPickerFoundation.hexToRgba(color as string)
            };
        } else {
            throw new Error('format error');
        }

        this._adapter.notifyChange(currentColor);
        if (!this.getProp("value")) {
            this._adapter.setState({ currentColor: currentColor });
        }
       
    }


    handleAlphaChangeByHandle = (newAlpha: {a: number})=>{
        this.handleChangeA(this.getCurrentColor(), newAlpha.a);
    }

    handleColorChangeByHandle = (newHue: {h: number})=>{
        this.handleChangeH(this.getCurrentColor(), newHue.h);
    }


    getHandlePositionByHSVA = (hsva: HsvaColor, { width, height }: {width: number;height: number}, handleSize: number)=>{

        const defaultColorPosition = { x: hsva.s / 100 * width, y: (1 - hsva.v / 100) * height };
        return { x: defaultColorPosition.x - handleSize / 2, y: defaultColorPosition.y - handleSize / 2 };
    }

    getHandlePositionByMousePosition = (mousePosition: {x: number;y: number}, { width, height }: {width: number;height: number}, handleSize: number)=>{
        if (mousePosition.x > width || mousePosition.x < 0) {
            return null;
        }

        if (mousePosition.y > height || mousePosition.y < 0) {
            return null;
        }

        const handlePosition = {
            x: mousePosition.x - handleSize / 2,
            y: mousePosition.y - handleSize / 2
        };

        return handlePosition;
    }


    getAlphaHandlePositionByMousePosition = (mousePosition: number, width: number, handleSize: number)=>{
        if (mousePosition < 0 || mousePosition > width) {
            return null;
        }
        return mousePosition - handleSize / 2;
    }

    getColorHandlePositionByMousePosition = (mousePosition: number, width: number, handleSize: number)=>{
        if (mousePosition < 0 || mousePosition > width) {
            return null;
        }

        return mousePosition - handleSize / 2;
    }


    




}

export default ColorPickerFoundation;


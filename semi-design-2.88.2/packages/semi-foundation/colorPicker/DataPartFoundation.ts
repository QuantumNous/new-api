import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import ColorPickerFoundation, { ColorPickerProps } from "./foundation";
import split from "./utils/split";
import { HsvaColor, RgbaColor } from "./interface";


type Value = ColorPickerProps['value']

export interface DataPartBaseProps {
    currentColor: Value;
    defaultFormat: 'hex' | 'rgba' | 'hsva';
    width: number;
    alpha?: boolean;
    foundation: ColorPickerFoundation;
    eyeDropper: boolean
}

export interface DataPartBaseState {
    format: 'hex' | 'rgba' | 'hsva';
    inputValue: string
}


export interface DataPartAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getColorPickerFoundation: () => ColorPickerFoundation
}


class DataPartFoundation extends BaseFoundation<DataPartAdapter<DataPartBaseProps, DataPartBaseState>, DataPartBaseProps, DataPartBaseState> {

    constructor(adapter: DataPartAdapter<DataPartBaseProps, DataPartBaseState>) {
        super({
            ...adapter
        });
    }

    getInputValue = () => {
        const { currentColor } = this._adapter.getProps();
        const { format } = this._adapter.getStates();
        const rgba = currentColor.rgba;
        const hsva = currentColor.hsva;
        const hex = currentColor.hex;
        if (format === 'rgba') {
            return `${rgba.r},${rgba.g},${rgba.b}`;
        } else if (format === 'hsva') {
            return `${hsva.h},${hsva.s},${hsva.v}`;
        } else {
            return hex.slice(0, 7);
        }
    }

    getValueByInputValue = (value: string) => {
        const { format } = this.getStates();
        if (format === 'rgba') {
            const result = split(value, format);
            if (result) {
                return result as RgbaColor;
            }

        } else if (format === 'hsva') {
            const result = split(value, format);
            if (result) {
                return result as HsvaColor;
            }
        } else if (format === 'hex') {
            // hack chrome bug, format mismatch with w3c.
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            if (/#[\d\w]{6,8}/.test(value)) {
                return value;
            }
        }
        return false;
    }

    handlePickValueWithStraw = async () => {
        const colorPickerFoundation = this._adapter.getColorPickerFoundation();
        if (!window['EyeDropper']) {
            return;
        }
        //@ts-ignore
        const eyeDropper = new EyeDropper();

        try {
            const result = await eyeDropper.open();
            const color = result['sRGBHex'];
            if (color.startsWith("#")) {
                colorPickerFoundation.handleChange(color, 'hex');
            } else if (color.startsWith('rgba')) {
                const rgba = ColorPickerFoundation.rgbaStringToRgba(color);
                rgba.a = 1;
                colorPickerFoundation.handleChange(rgba, 'rgba');
            }
        } catch (e) {

        }
    }


    handleInputValueChange = (value: string) => {
        this._adapter.setState({ inputValue: value });
    }

    handleFormatChange = (format: DataPartBaseState['format']) => {
        this._adapter.setState({ format });
    }


}


export default DataPartFoundation;

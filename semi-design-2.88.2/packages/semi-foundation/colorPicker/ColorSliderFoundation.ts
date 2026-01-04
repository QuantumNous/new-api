import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import ColorPickerFoundation from "./foundation";

export interface ColorSliderBaseProps {
    width: number;
    height: number;
    hue: number;
    handleSize: number;
    foundation: ColorPickerFoundation
}

export interface ColorSliderBaseState {
    handlePosition: number;
    isHandleGrabbing: boolean
}


export interface ColorSliderAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    handleMouseDown: (e: any) => void;
    handleMouseUp: (e: any) => void;
    getColorPickerFoundation: () => ColorPickerFoundation;
    getDOM: () => HTMLDivElement
}


class ColorSliderFoundation extends BaseFoundation<ColorSliderAdapter<ColorSliderBaseProps, ColorSliderBaseState>, ColorSliderBaseProps, ColorSliderBaseState> {

    constructor(adapter: ColorSliderAdapter<ColorSliderBaseProps, ColorSliderBaseState>) {
        super({
            ...adapter
        });
    }

    handleMouseDown = (e: any) => {
        this._adapter.handleMouseDown(e);
    }


    handleMouseUp = (e: any) => {
        this._adapter.handleMouseUp(e);
    }


    setHandlePositionByMousePosition = (e: MouseEvent) => {
        const rect = this._adapter.getDOM()?.getBoundingClientRect();
        if (!rect) {
            return;
        }
        const { width, handleSize } = this._adapter.getProps();
        const colorPickerFoundation = this._adapter.getColorPickerFoundation();
        const mousePosition = e.clientX - rect.x;
        colorPickerFoundation.handleColorChangeByHandle({ h: Math.round(Math.min(Math.max(mousePosition / width, 0), 1) * 360) });
        const handlePosition = colorPickerFoundation.getColorHandlePositionByMousePosition(mousePosition, width, handleSize);
        this.setState({ handlePosition });
    }


}


export default ColorSliderFoundation;
import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import ColorPickerFoundation from "./foundation";
import { HsvaColor } from "./interface";


export interface ColorChooseAreaBaseProps {
    hsva: HsvaColor;
    onChange: (newColor: { s: number; v: number }) => void;
    handleSize: number;
    width: number;
    height: number;
    foundation: ColorPickerFoundation
}

export interface ColorChooseAreaBaseState {
    handlePosition: { x: number; y: number };
    isHandleGrabbing: boolean
}


export interface ColorChooseAreaAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getColorPickerFoundation: () => ColorPickerFoundation;
    handleMouseDown: (e: any) => void;
    handleMouseUp: (e: any) => void;
    getDOM: () => HTMLDivElement;
    notifyChange: (newColor: { s: number; v: number }) => void
}


class ColorChooseAreaFoundation extends BaseFoundation<ColorChooseAreaAdapter<ColorChooseAreaBaseProps, ColorChooseAreaBaseState>, ColorChooseAreaBaseProps, ColorChooseAreaBaseState> {

    constructor(adapter: ColorChooseAreaAdapter<ColorChooseAreaBaseProps, ColorChooseAreaBaseState>) {
        super({
            ...adapter
        });
    }

    getHandlePositionByHSVA = () => {
        const { hsva, width, height, handleSize } = this.getProps();

        return this._adapter.getColorPickerFoundation().getHandlePositionByHSVA(hsva, {
            width: width,
            height: height
        }, handleSize);

    }

    handleMouseDown = (e: any) => {
        this._adapter.handleMouseDown(e);
    }

    handleMouseUp = (e: any) => {
        this._adapter.handleMouseUp(e);
    }


    setHandlePositionByMousePosition = (e: globalThis.MouseEvent) => {
        const rect = this._adapter.getDOM()?.getBoundingClientRect();
        if (!rect) {
            return;
        }
        const mousePosition = {
            x: e.clientX - rect.x,
            y: e.clientY - rect.y
        };
        const { width, height, handleSize } = this.getProps();
        const colorPickerFoundation = this._adapter.getColorPickerFoundation();
        const handlePosition = colorPickerFoundation.getHandlePositionByMousePosition(mousePosition, {
            width,
            height
        }, handleSize);
        if (handlePosition) {
            this.setState({ handlePosition });
            this._adapter.notifyChange({
                s: Math.round(mousePosition.x / width * 100),
                v: Math.round(100 - (Math.min(Math.max(mousePosition.y / height, 0), 1)) * 100),
            });
        }

    }


}


export default ColorChooseAreaFoundation;

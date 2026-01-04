import BaseFoundation, { DefaultAdapter } from "../base/foundation";

export interface PreviewFooterAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S>{}

export default class PreviewFooterFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<PreviewFooterAdapter<P, S>, P, S> {
    
    changeSliderValue = (type: string): void => {
        const { zoom, step, min, max } = this.getProps();
        let newValue = type === "plus" ? zoom + step : zoom - step;
        if (newValue > max) {
            newValue = max;
        } else if (newValue < min) {
            newValue = min;
        }
        this.handleValueChange(newValue);
    };

    handleValueChange = (value: number): void => {
        const { onZoomIn, onZoomOut, zoom } = this.getProps();
        if (value > zoom) {
            onZoomIn(Number((value / 100).toFixed(2)));
        } else {
            onZoomOut(Number((value / 100).toFixed(2)));
        }
    };

    handleRatioClick = (): void => {
        const { ratio, onAdjustRatio } = this.getProps();
        const type = ratio === "adaptation" ? "realSize" : "adaptation";
        onAdjustRatio(type);
    }

    handleRotate = (direction: string): void => {
        const { onRotate } = this.getProps();
        onRotate && onRotate(direction);
    }
    
}
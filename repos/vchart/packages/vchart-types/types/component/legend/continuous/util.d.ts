import type { IColorLegendSpec, ISizeLegendSpec } from './interface';
import { ColorContinuousLegend, SizeContinuousLegend } from '@visactor/vrender-components';
export declare function getContinuousLegendAttributes(spec: IColorLegendSpec | ISizeLegendSpec): any;
export declare function isContinuousLegend(type: string): boolean;
export declare const ContinuousLegendMap: {
    color: typeof ColorContinuousLegend;
    size: typeof SizeContinuousLegend;
};

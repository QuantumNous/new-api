import type { IGlobalScale } from '../scale/interface';
import type { IBaseScale } from '@visactor/vscale';
import { BandScale, LinearScale, OrdinalScale, PointScale, ThresholdScale } from '@visactor/vscale';
import type { IVisual } from '../typings/visual';
import { ColorOrdinalScale } from '../scale/color-ordinal-scale';
declare const defaultScaleMap: {
    linear: typeof LinearScale;
    band: typeof BandScale;
    point: typeof PointScale;
    ordinal: typeof OrdinalScale;
    threshold: typeof ThresholdScale;
    colorOrdinal: typeof ColorOrdinalScale;
};
export declare function createScale(type: keyof typeof defaultScaleMap): IBaseScale | null;
export declare function createScaleWithSpec(spec: IVisual<any>, context: {
    globalScale: IGlobalScale;
    seriesId: number;
}): IBaseScale | null;
export declare function valueInScaleRange(v: number, s?: IBaseScale, useWholeRange?: boolean): number;
export declare function isValueInScaleDomain(v: number | number[], s?: IBaseScale, useWholeRange?: boolean): boolean;
export declare function isSpecValueWithScale(specValue: any): boolean;
export {};

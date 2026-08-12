import type { FederatedPointerEvent, SymbolType } from '@visactor/vrender-core';
import type { IPolygonMarkSpec } from '../../typings';
import type { IComponent } from '../interface';
import type { IDelayType } from '../../typings/event';
export type IBrush = IComponent;
interface IBrushDataBindSpec {
    regionIndex?: number | number[];
    regionId?: string | string[];
    seriesIndex?: number | number[];
    seriesId?: string | string[];
    brushLinkSeriesIndex?: number | number[];
    brushLinkSeriesId?: string | string[];
    zoomAfterBrush?: boolean;
    zoomWhenEmpty?: boolean;
    axisId?: string | string[];
    axisIndex?: number | number[];
    axisRangeExpand?: number;
    beforeBrushChange?: (e: FederatedPointerEvent) => void | boolean;
    disableDimensionHoverWhenBrushing?: boolean;
}
export interface IBrushTheme {
    style?: Partial<IPolygonMarkSpec>;
    inBrush?: selectedItemStyle;
    outOfBrush?: selectedItemStyle;
    brushMode?: IBrushMode;
    brushType?: IBrushType;
    brushMoved?: boolean;
    removeOnClick?: boolean;
    delayType?: IDelayType;
    delayTime?: number;
    sizeThreshold?: number;
    markTypeFilter?: string[];
    onBrushEnd?: (e: any) => boolean;
}
export interface IBrushSpec extends IBrushTheme, IBrushDataBindSpec {
    id?: string;
    visible?: boolean;
    updateElementsState?: boolean;
}
export type IBrushType = 'x' | 'y' | 'rect' | 'polygon';
export type IBrushMode = 'single' | 'multiple';
export type selectedItemStyle = {
    symbol?: SymbolType;
    symbolSize?: number;
    color?: string;
    colorAlpha?: number;
} & Partial<IPolygonMarkSpec>;
export type BrushInteractiveRangeAttr = {
    interactiveRange: {
        minY: number;
        maxY: number;
        minX: number;
        maxX: number;
    };
    xRange: [number, number];
    yRange: [number, number];
};
export {};

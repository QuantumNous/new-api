import type { IRoamDragSpec, IRoamScrollSpec, IRoamZoomSpec } from './interface';
import type { BaseEventParams, IEvent } from '../../event/interface';
import type { IDataZoomSpec } from './data-zoom/interface';
import type { IRegion } from '../../region';
import { type ILayoutRect } from '../../typings';
import type { IComponentOption } from '../interface';
export declare class DataFilterEvent {
    protected _type: 'dataZoom' | 'scrollBar';
    protected _spec: IDataZoomSpec;
    protected _option: IComponentOption;
    protected _handleChange: (start: number, end: number, updateComponent?: boolean) => void;
    protected getLayoutRect: () => ILayoutRect;
    protected getState: () => {
        start: number;
        end: number;
    };
    protected getRegions: () => IRegion[];
    protected getOption: () => IComponentOption;
    protected getEvent: () => IEvent;
    protected _isHorizontal: boolean;
    protected _regions: IRegion[];
    protected _activeRoam: boolean;
    protected _zoomAttr: IRoamZoomSpec;
    protected _dragAttr: IRoamDragSpec;
    protected _scrollAttr: IRoamScrollSpec;
    enableInteraction(): void;
    disableInteraction(): void;
    zoomIn(location?: {
        x: number;
        y: number;
    }): void;
    zoomOut(location?: {
        x: number;
        y: number;
    }): void;
    constructor(type: 'dataZoom' | 'scrollBar', spec: IDataZoomSpec, handleChange: (start: number, end: number, updateComponent?: boolean) => void, getLayoutRect: () => ILayoutRect, getState: () => {
        start: number;
        end: number;
    }, getRegions: () => IRegion[], getOption: () => IComponentOption, getEvent: () => IEvent);
    setEventAttrFromSpec(): void;
    initZoomEvent: () => void;
    handleChartZoom: (params: {
        zoomDelta: number;
        zoomX?: number;
        zoomY?: number;
    }, e?: BaseEventParams['event']) => void;
    handleChartScroll: (params: {
        scrollX: number;
        scrollY: number;
    }, e: BaseEventParams['event']) => boolean;
    handleChartDrag: (delta: [number, number], e: BaseEventParams['event']) => void;
    handleChartMove: (value: number, rate: number) => boolean;
}

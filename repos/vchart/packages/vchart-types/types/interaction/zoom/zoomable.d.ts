import type { BaseEventParams, ExtendEventParam, IEvent } from '../../event/interface';
import type { IRegion } from '../../region/interface';
import type { RenderMode } from '../../typings/spec';
import type { ISeries } from '../../series/interface';
import type { IDelayType } from '../../typings/event';
export interface ITriggerOption {
    delayType: IDelayType;
    delayTime: number;
    realTime: boolean;
    allowComponentZoom?: boolean;
}
export type ZoomEventParams = {
    zoomDelta: number;
    zoomX: number;
    zoomY: number;
};
export type ZoomCallback = (params: ZoomEventParams, e: BaseEventParams['event']) => Record<string, any> | void;
export interface IZoomable {
    initZoomable: (evt: IEvent, mode?: RenderMode) => void;
    initZoomEventOfSeries: (s: ISeries, callback?: ZoomCallback) => any;
    initZoomEventOfRegions: (regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: ZoomCallback, option?: ITriggerOption) => void;
    initScrollEventOfSeries: (s: ISeries, callback?: (params: {
        scrollX: number;
        scrollY: number;
    }, e: BaseEventParams['event']) => void) => any;
    initScrollEventOfRegions: (regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: (params: {
        scrollX: number;
        scrollY: number;
    }, e: BaseEventParams['event']) => void, option?: ITriggerOption) => void;
    initDragEventOfSeries: (s: ISeries, callback?: (delta: [number, number], e: BaseEventParams['event']) => void, option?: ITriggerOption) => any;
    initDragEventOfRegions: (regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: (delta: [number, number], e: BaseEventParams['event']) => void, option?: ITriggerOption) => void;
}
export declare class Zoomable implements IZoomable {
    private _clickEnable;
    private _option;
    private _zoomableTrigger;
    private _eventObj;
    private _renderMode;
    private _gestureController;
    private _isGestureListener;
    initZoomable(evt: IEvent, mode?: RenderMode): void;
    private _getZoomTriggerEvent;
    private _zoomEventDispatch;
    private _getRegionOrSeriesLayout;
    private _bindZoomEventAsRegion;
    initZoomEventOfSeries(s: ISeries, callback?: ZoomCallback, option?: ITriggerOption): void;
    initZoomEventOfRegions(regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: ZoomCallback, option?: ITriggerOption): void;
    private _scrollEventDispatch;
    private _bindScrollEventAsRegion;
    initScrollEventOfSeries(s: ISeries, callback?: (params: {
        scrollX: number;
        scrollY: number;
    }, e: BaseEventParams['event']) => void, option?: ITriggerOption): void;
    initScrollEventOfRegions(regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: (params: {
        scrollX: number;
        scrollY: number;
    }, e: BaseEventParams['event']) => void, option?: ITriggerOption): void;
    private _bindDragEventAsRegion;
    initDragEventOfSeries(s: ISeries, callback?: (delta: [number, number], e: BaseEventParams['event']) => void, option?: ITriggerOption): void;
    initDragEventOfRegions(regions: IRegion[], filter?: (s: ISeries) => boolean, callback?: (delta: [number, number], e: BaseEventParams['event']) => void, option?: ITriggerOption): void;
    private _handleDragMouseUp?;
    private _handleDragMouseMove?;
    protected _clearDragEvent(): void;
    private isDragEnable;
    protected _handleDrag(params: ExtendEventParam, callback?: (delta: [number, number], e: BaseEventParams['event']) => void, option?: ITriggerOption): void;
}

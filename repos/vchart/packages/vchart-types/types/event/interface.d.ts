import type { IGraphic } from '@visactor/vrender-core';
import type { IChart } from '../chart/interface';
import type { IModel } from '../model/interface';
import type { IMark, IMarkGraphic, MarkType } from '../mark/interface';
import type { DimensionEventParams } from './events/dimension/interface';
import type { Datum, IPoint, RenderMode, StringOrNumber } from '../typings';
import type { ChartEvent, Event_Bubble_Level, Event_Source_Type, HOOK_EVENT } from '../constant/event';
import type { SeriesType } from '../series/interface';
import type { TooltipEventParams } from '../component/tooltip/interface/event';
import type { ILayoutItem } from '../layout/interface';
import type { IVChart } from '../core/interface';
export type EventType = 'pointerdown' | 'pointerup' | 'pointerupoutside' | 'pointertap' | 'pointerover' | 'pointermove' | 'pointerenter' | 'pointerleave' | 'pointerout' | 'mousedown' | 'mouseup' | 'mouseupoutside' | 'rightdown' | 'rightup' | 'rightupoutside' | 'click' | 'dblclick' | 'mousemove' | 'mouseover' | 'mouseout' | 'mouseenter' | 'mouseleave' | 'wheel' | 'touchstart' | 'touchend' | 'touchendoutside' | 'touchmove' | 'touchcancel' | 'tap' | 'dragstart' | 'drag' | 'dragenter' | 'dragleave' | 'dragover' | 'dragend' | 'drop' | 'pan' | 'panstart' | 'panend' | 'press' | 'pressup' | 'pressend' | 'pinch' | 'pinchstart' | 'pinchend' | 'swipe' | keyof typeof ChartEvent | keyof typeof HOOK_EVENT | string;
export type EventBubbleLevel = keyof typeof Event_Bubble_Level;
export type ComponentType = 'axis' | 'dataZoom' | 'indicator' | 'legend' | 'markLine' | 'markArea' | 'markPoint' | 'tooltip' | 'title' | 'label' | 'totalLabel' | 'customMark';
export type EventTargetType = MarkType | ComponentType | SeriesType;
export type EventSourceType = keyof typeof Event_Source_Type;
export type EventQuery = {
    level?: EventBubbleLevel;
    source?: EventSourceType;
    nodeName?: string;
    markName?: string;
    type?: EventTargetType;
    id?: StringOrNumber;
    filter?: (params: Partial<BaseEventParams>) => boolean;
    throttle?: number;
    debounce?: number;
    consume?: boolean;
};
export type EventParams = {
    event?: SuperEvent;
    value?: any;
    mark?: IMark;
    model?: IModel;
    chart?: IChart;
    datum?: Datum;
    node?: IGraphic;
    vchart?: IVChart;
};
type SuperEvent = Event & {
    [key: string]: any;
};
export type BaseEventParams = EventParams & {
    event: SuperEvent;
    item: IMarkGraphic;
    datum: Datum;
    source: EventSourceType;
};
export type EventCallback<Params extends EventParams> = (params: Params) => boolean | void;
export type EventFilter = {
    source: EventSourceType;
    level: EventBubbleLevel;
    type: string | null;
    markName: string | null;
    nodeName: string | null;
    userId: StringOrNumber | null;
    filter: (params: Partial<BaseEventParams>) => boolean | null;
};
export type EventHandler<Params extends EventParams> = {
    callback: EventCallback<Params>;
    query: EventQuery | null;
    wrappedCallback?: EventCallback<Params>;
    filter?: EventFilter;
    prevented?: boolean;
};
export type ExtendEventParam = EventParams & {
    event?: Event;
    item?: IMarkGraphic;
    datum?: Datum;
    source?: EventSourceType;
};
export type LayoutEventParam = {
    elements: (ILayoutItem & {
        type: string;
    })[];
} & Partial<BaseEventParams>;
export type PanEventParam = ExtendEventParam & {
    delta: [number, number];
};
export type ZoomEventParam = ExtendEventParam & {
    scale: number;
    scaleCenter: IPoint;
};
export type InteractionEventParam = {
    graphics?: IMarkGraphic[];
    datums?: Datum[];
} & Partial<BaseEventParams>;
export type EventParamsDefinition = {
    pointerdown: BaseEventParams;
    pointerup: BaseEventParams;
    pointerupoutside: BaseEventParams;
    pointertap: BaseEventParams;
    pointerover: BaseEventParams;
    pointermove: BaseEventParams;
    pointerenter: BaseEventParams;
    pointerleave: BaseEventParams;
    pointerout: BaseEventParams;
    mousedown: BaseEventParams;
    mouseup: BaseEventParams;
    mouseupoutside: BaseEventParams;
    rightdown: BaseEventParams;
    rightup: BaseEventParams;
    rightupoutside: BaseEventParams;
    click: BaseEventParams;
    dblclick: BaseEventParams;
    mousemove: BaseEventParams;
    mouseover: BaseEventParams;
    mouseout: BaseEventParams;
    mouseenter: BaseEventParams;
    mouseleave: BaseEventParams;
    wheel: BaseEventParams;
    touchstart: BaseEventParams;
    touchend: BaseEventParams;
    touchendoutside: BaseEventParams;
    touchmove: BaseEventParams;
    touchcancel: BaseEventParams;
    dragstart: BaseEventParams;
    drag: BaseEventParams;
    dragenter: BaseEventParams;
    dragleave: BaseEventParams;
    dragover: BaseEventParams;
    dragend: BaseEventParams;
    drop: BaseEventParams;
    tap: BaseEventParams;
    pan: BaseEventParams;
    panstart: BaseEventParams;
    panend: BaseEventParams;
    press: BaseEventParams;
    pressup: BaseEventParams;
    pressend: BaseEventParams;
    pinch: BaseEventParams;
    pinchstart: BaseEventParams;
    pinchend: BaseEventParams;
    swipe: BaseEventParams;
    dimensionHover: DimensionEventParams;
    dimensionClick: DimensionEventParams;
    tooltipShow: TooltipEventParams;
    tooltipHide: TooltipEventParams;
    tooltipRelease: TooltipEventParams;
    afterLayout: LayoutEventParam;
    'element-select:start': InteractionEventParam;
    'element-select:reset': InteractionEventParam;
    'element-highlight:start': InteractionEventParam;
    'element-highlight:reset': InteractionEventParam;
    [key: string]: ExtendEventParam;
};
export interface IEventDispatcher {
    globalInstance: IVChart;
    register: <Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) => this;
    unregister: <Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>) => this;
    dispatch: <Evt extends EventType>(eType: Evt, params?: EventParamsDefinition[Evt], level?: EventBubbleLevel) => this;
    clear: () => void;
    release: () => void;
    prevent: <Evt extends EventType>(eType: Evt, except?: {
        handler: EventCallback<EventParamsDefinition[Evt]>;
        level: EventBubbleLevel;
    }) => void;
    allow: <Evt extends EventType>(eType: Evt) => void;
}
export interface IEvent {
    on: (<Evt extends EventType>(eType: Evt, callback: EventCallback<EventParamsDefinition[Evt]>) => this) & (<Evt extends EventType>(eType: Evt, query: EventQuery, callback: EventCallback<EventParamsDefinition[Evt]>) => this);
    off: (<Evt extends EventType>(eType: Evt, callback?: EventCallback<EventParamsDefinition[Evt]>) => this) & (<Evt extends EventType>(eType: Evt, query: EventQuery, callback: EventCallback<EventParamsDefinition[Evt]>) => this);
    emit: <Evt extends EventType>(eType: Evt, params: EventParamsDefinition[Evt], level?: EventBubbleLevel) => void;
    release: () => void;
    getComposedEventMap: () => Map<EventCallback<EventParams>, {
        eventType: EventType;
        event: IComposedEvent;
    }>;
    prevent: <Evt extends EventType>(eType: Evt, except?: {
        handler: EventCallback<EventParamsDefinition[Evt]>;
        level: EventBubbleLevel;
    }) => void;
    allow: <Evt extends EventType>(eType: Evt) => void;
}
export interface IComposedEvent {
    register: <Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) => void;
    unregister: () => void;
    dispatch: (v: unknown, opt: unknown) => unknown;
}
export interface IComposedEventConstructor {
    new (eventDispatcher: IEventDispatcher, mode: RenderMode): IComposedEvent;
}
export {};

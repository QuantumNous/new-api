import type { BaseEventParams } from '../../event/interface';
import type { IOrientType } from '../../typings';
import type { IDelayType } from '../../typings/event';
import type { IComponentSpec } from '../base/interface';
import type { IComponent } from '../interface';
export interface IDataFilterComponentSpec extends Omit<IComponentSpec, 'width' | 'height'> {
    visible?: boolean;
    orient?: IOrientType;
    width?: 'auto' | number;
    height?: 'auto' | number;
    field?: string;
    axisId?: string;
    axisIndex?: number;
    regionIndex?: number | number[];
    start?: number;
    end?: number;
    startValue?: number | string;
    endValue?: number | string;
    valueField?: string;
    rangeMode?: [string, string];
    autoIndent?: boolean;
    auto?: boolean;
    zoomLock?: boolean;
    minSpan?: number;
    maxSpan?: number;
    minValueSpan?: number;
    maxValueSpan?: number;
    delayType?: IDelayType;
    delayTime?: number;
    roamZoom?: IRoamZoomSpec | boolean;
    roamDrag?: IRoamDragSpec | boolean;
    roamScroll?: IRoamScrollSpec | boolean;
    realTime?: boolean;
    customDomain?: any[];
    updateDataAfterChange?: (start: number, end: number, startValue: any, endValue: any) => void;
}
export interface IRoamDragSpec extends IRoamSpec {
    reverse?: boolean;
    filter?: (delta: [number, number], e?: BaseEventParams['event']) => boolean;
    autoVisible?: boolean;
}
export interface IRoamScrollSpec extends IRoamSpec {
    reverse?: boolean;
    filter?: (params: {
        scrollX: number;
        scrollY: number;
    }, e?: BaseEventParams['event']) => boolean;
}
export interface IRoamZoomSpec extends IRoamSpec {
    focus?: boolean;
    filter?: (params: {
        zoomDelta: number;
        zoomX?: number;
        zoomY?: number;
    }, e?: BaseEventParams['event']) => boolean;
}
export interface IRoamSpec {
    enable?: boolean;
    rate?: number;
}
export interface IDataFilterComponent extends IComponent {
    setStartAndEnd: (start: number | string, end: number | string, rangeMode: ['percent' | 'value', 'percent' | 'value']) => void;
    enableInteraction: () => void;
    disableInteraction: () => void;
    zoomIn: (location?: {
        x: number;
        y: number;
    }) => void;
    zoomOut: (location?: {
        x: number;
        y: number;
    }) => void;
}
export type IFilterMode = 'filter' | 'axis';

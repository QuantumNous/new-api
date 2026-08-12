import type { IApp, IColor, IStageParams, IStage, ILayer, IOption3D, ITicker } from '@visactor/vrender-core';
import type { IPerformanceHook, RenderMode } from '../../typings/spec/common';
import type { IBoundsLike } from '@visactor/vutils';
import type { StringOrNumber } from '../../typings';
export declare enum LayoutState {
    before = "before",
    layouting = "layouting",
    reevaluate = "reevaluate",
    after = "after"
}
export interface IRenderContainer {
    dom?: HTMLElement | 'none';
    canvas?: HTMLCanvasElement | string;
}
export type IOptimizeType = {
    skipRenderWithOutRange?: boolean;
    disableCheckGraphicWidthOutRange?: boolean;
};
export interface GestureConfig {
    press?: {
        time?: number;
        threshold?: number;
    };
    swipe?: {
        threshold?: number;
        velocity?: number;
    };
    tap?: {
        interval?: number;
    };
}
export interface IRenderOption {
    mode?: RenderMode;
    gestureConfig?: GestureConfig;
    modeParams?: {
        tooltipCanvasId?: StringOrNumber;
        [key: string]: any;
    } | unknown;
    autoRefreshDpr?: boolean;
    dpr?: number;
    interactive?: boolean;
    viewBox?: IBoundsLike;
    canvasControled?: boolean;
    stage?: IStage;
    app?: IApp;
    layer?: ILayer;
    beforeRender?: IStageParams['beforeRender'];
    afterRender?: IStageParams['afterRender'];
    renderHooks?: {
        afterClearScreen?: IStageParams['afterClearScreen'];
        afterClearRect?: IStageParams['afterClearRect'];
        [key: string]: any;
    };
    background?: IColor;
    logLevel?: number;
    onError?: (...args: any[]) => void;
    disableDirtyBounds?: boolean;
    enableView3dTransform?: boolean;
    pluginList?: string[];
    ticker?: ITicker;
    optimize?: IOptimizeType;
    enableHtmlAttribute?: boolean;
    supportsTouchEvents?: boolean;
    supportsPointerEvents?: boolean;
    ReactDOM?: any;
    clickInterval?: number;
    autoPreventDefault?: boolean;
    performanceHook?: IPerformanceHook;
    options3d?: {
        enable?: boolean;
        enableView3dTranform?: boolean;
    } & IOption3D;
}

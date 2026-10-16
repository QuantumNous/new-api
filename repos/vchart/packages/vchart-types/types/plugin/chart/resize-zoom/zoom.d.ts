import type { IChartPlugin, IChartPluginService } from '../interface';
import { BasePlugin } from '../../base/base-plugin';
import type { IPoint } from '../../../typings';
export declare class ChartResizeZoomPlugin extends BasePlugin<IChartPluginService> implements IChartPlugin {
    static readonly pluginType: 'chart';
    static readonly specKey = "resizeZoom";
    static readonly type: string;
    readonly type: string;
    protected _container?: HTMLElement;
    protected _triggerEvent?: string;
    protected _minZoom?: number;
    protected _maxZoom?: number;
    protected _zoom: number;
    protected _rate?: number;
    constructor();
    onAfterInitChart(service: IChartPluginService, chartSpec: any): void;
    protected _onWheel: (e: WheelEvent) => void;
    zoom(zoom: number, pointerPos?: IPoint): void;
    release(): void;
}
export declare const registerChartResizeZoomPlugin: () => void;

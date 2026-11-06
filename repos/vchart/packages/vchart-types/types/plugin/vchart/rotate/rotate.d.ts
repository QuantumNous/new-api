import { BasePlugin } from '../../base/base-plugin';
import type { IVChartPlugin, IVChartPluginService } from '../interface';
export declare class RotatePlugin extends BasePlugin implements IVChartPlugin {
    static readonly pluginType: 'vchart';
    static readonly specKey = "rotate";
    static readonly type: string;
    readonly type: string;
    private rotateDegree;
    private matrix;
    private vglobal_mapToCanvasPoint;
    private _vchart;
    constructor();
    onInit(service: IVChartPluginService): void;
    rotate90WithTransform: (rotateDom: HTMLElement) => void;
    cancelTransform: (rotateDom: HTMLElement) => void;
    release(): void;
}
export declare const registerRotatePlugin: () => void;

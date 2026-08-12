import { BaseTooltipHandler } from '../base';
import { Tooltip as TooltipComponent } from '@visactor/vrender-components';
import type { TooltipHandlerParams } from '../../../../component/tooltip';
import type { IComponentPluginService } from '../../interface';
export declare class CanvasTooltipHandler extends BaseTooltipHandler {
    static readonly type: string;
    readonly type: string;
    private _layer;
    protected _el?: HTMLCanvasElement;
    protected _tooltipCanvasId?: string;
    protected _tooltipComponent: TooltipComponent;
    constructor();
    onAdd(service: IComponentPluginService<any>): void;
    private _initTooltipComponent;
    private _getLayer;
    protected _removeTooltip(): void;
    protected _updateTooltip(visible: boolean, params: TooltipHandlerParams): void;
    isTooltipShown(): boolean;
    release(): void;
}
export declare const registerCanvasTooltipHandler: () => void;

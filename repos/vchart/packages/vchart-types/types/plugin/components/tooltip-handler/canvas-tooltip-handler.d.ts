import { BaseTooltipHandler } from './base';
import { Tooltip as TooltipComponent } from '@visactor/vrender-components/tooltip';
import type { TooltipHandlerParams } from '../../../component/tooltip';
import type { IComponentPluginService } from '../interface';
import type { ITooltipActual } from '../../../typings';
import type { IContainerSize } from '@visactor/vrender-components/tooltip/type';
import type { ITooltipAttributes } from './interface';
export declare class CanvasTooltipHandler extends BaseTooltipHandler {
    static readonly type: string;
    readonly type: string;
    private _layer;
    protected _el?: HTMLCanvasElement;
    protected _tooltipCanvasId?: string;
    protected _tooltipComponent: TooltipComponent;
    protected _attributes?: ITooltipAttributes | null;
    constructor();
    onAdd(service: IComponentPluginService<any>): void;
    private _initTooltipComponent;
    private _getLayer;
    protected _getTooltipBoxSize(actualTooltip: ITooltipActual, changePositionOnly: boolean): IContainerSize | undefined;
    protected _removeTooltip(): void;
    protected _updateTooltip(visible: boolean, params: TooltipHandlerParams): void;
    isTooltipShown(): boolean;
    release(): void;
}
export declare const registerCanvasTooltipHandler: () => void;

import type { IToolTipActual } from '../../../../typings/tooltip';
import type { TooltipHandlerParams } from '../../interface';
import { BaseTooltipHandler } from '../base';
import { Tooltip as TooltipComponent } from '@visactor/vrender-components';
import type { Tooltip } from '../../tooltip';
export declare class CanvasTooltipHandler extends BaseTooltipHandler {
    type: string;
    private _layer;
    protected _el?: HTMLCanvasElement;
    protected _tooltipCanvasId?: string;
    protected _tooltipComponent: TooltipComponent;
    constructor(tooltipId: string, component: Tooltip);
    private _initTooltipComponent;
    private _getLayer;
    protected _removeTooltip(): void;
    protected _updateTooltip(visible: boolean, params: TooltipHandlerParams, actualTooltip: IToolTipActual): void;
    isTooltipShown(): boolean;
    release(): void;
}

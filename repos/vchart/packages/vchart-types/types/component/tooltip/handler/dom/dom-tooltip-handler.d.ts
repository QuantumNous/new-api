import type { IToolTipActual } from '../../../../typings/tooltip';
import type { ITooltipSpec, TooltipHandlerParams } from '../../interface';
import { BaseTooltipHandler } from '../base';
import type { IDomTooltipStyle } from './interface';
import { TooltipModel } from './model/tooltip-model';
import type { Tooltip } from '../../tooltip';
import type { Maybe } from '@visactor/vutils';
export declare class DomTooltipHandler extends BaseTooltipHandler {
    type: string;
    protected _tooltipContainer: HTMLElement;
    protected _domStyle: IDomTooltipStyle;
    protected _tooltipActual?: IToolTipActual;
    protected _container: Maybe<HTMLDivElement>;
    protected model: TooltipModel;
    getVisibility(): boolean;
    setVisibility(_value: boolean): void;
    constructor(tooltipId: string, component: Tooltip);
    initEl(): void;
    protected _removeTooltip(): void;
    protected _updateTooltip(visible: boolean, params: TooltipHandlerParams, actualTooltip: IToolTipActual): void;
    protected _initStyle(): void;
    protected _getParentElement(spec: ITooltipSpec): HTMLElement;
    isTooltipShown(): boolean;
    reInit(): void;
}

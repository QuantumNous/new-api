import type { ITooltipLineActual } from '../../typings';
export declare const TooltipHandlerType: {
    dom: string;
    canvas: string;
};
export declare const TOOLTIP_EL_CLASS_NAME = "vchart-tooltip-element";
export declare const TOOLTIP_MAX_LINE_COUNT = 20;
export declare const TOOLTIP_OTHERS_LINE: ITooltipLineActual;
export declare const enum TooltipType {
    group = "group",
    mark = "mark",
    dimension = "dimension"
}
export declare const DEFAULT_SHOW_DELAY = 50;

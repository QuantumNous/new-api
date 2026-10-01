import type { IChart } from '../chart/interface/chart';
import type { StringOrNumber } from './common';
import type { TooltipActiveType } from './tooltip';
export interface IRegionQuerier {
    regionId?: StringOrNumber;
    regionIndex?: number;
}
export interface IShowTooltipOption extends IRegionQuerier {
    x?: number;
    y?: number;
    alwaysShow?: boolean;
    activeType?: TooltipActiveType;
}
export interface utilFunctionCtx {
    chart?: IChart;
    onError?: (...args: any[]) => void;
}

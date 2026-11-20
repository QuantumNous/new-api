import type { IChart } from '../chart/interface/chart';
import type { StringOrNumber } from './common';
import type { TooltipActiveType } from './tooltip';

export interface IRegionQuerier {
  regionId?: StringOrNumber;
  regionIndex?: number;
}

export interface IShowTooltipOption extends IRegionQuerier {
  /* tooltip预期显示的x坐标（为空则在图元附近） */
  x?: number;
  /* tooltip预期显示的y坐标（为空则在图元附近） */
  y?: number;
  /* 是否常显（如果为false或空的话，手动触发tooltip之后，tooltip可能被自动触发的别的tooltip替代） */
  alwaysShow?: boolean;
  /* tooltip类型（为空则自动判断） */
  activeType?: TooltipActiveType;
}

export interface utilFunctionCtx {
  chart?: IChart;
  onError?: (...args: any[]) => void;
}

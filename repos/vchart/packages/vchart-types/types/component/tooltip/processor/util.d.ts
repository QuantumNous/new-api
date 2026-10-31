import type { Maybe } from '@visactor/vutils';
import type { DimensionTooltipInfo, MarkTooltipInfo, TooltipInfo } from './interface';
export declare const isMarkInfo: (info: Maybe<TooltipInfo>) => info is MarkTooltipInfo<import("../../..").Datum>;
export declare const isDimensionInfo: (info: Maybe<TooltipInfo>) => info is DimensionTooltipInfo;

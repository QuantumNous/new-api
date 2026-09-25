import type { Maybe } from '@visactor/vutils';
import type { IDomTooltipStyle } from './interface';
import type { TooltipAttributes } from '@visactor/vrender-components';
export declare const getPixelPropertyStr: (num?: number | number[], defaultStr?: string) => string;
export declare const pixelPropertyStrToNumber: (str: string) => number | number[];
export declare function getDomStyles(attributes?: Maybe<TooltipAttributes>): IDomTooltipStyle;

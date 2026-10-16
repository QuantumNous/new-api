import type { Datum } from '../common';
import type { TooltipHandlerParams } from '../../component/tooltip/interface';
import type { TooltipData } from './handler';
export type TooltipContentProperty<T> = T | TooltipContentCallback<T> | {
    field: string;
};
export type TooltipContentCallback<T> = (datum?: Datum, params?: TooltipHandlerParams) => T | undefined;
export type TooltipPatternProperty<T> = T | TooltipPatternCallback<T>;
export type TooltipPatternCallback<T> = (data?: TooltipData, params?: TooltipHandlerParams) => T | undefined;
export type TooltipUpdateCallback<T> = (prev: T | undefined, data?: TooltipData, params?: TooltipHandlerParams) => T | undefined;

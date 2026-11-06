import type { Datum } from '@visactor/vgrammar-core';
import type { MaybeArray, TooltipContentProperty, TooltipData, TooltipPatternProperty } from '../../../../typings';
import type { TooltipHandlerParams } from '../../interface';
import type { ITooltipTextStyle } from '../interface/style';
import type { TooltipRichTextAttrs } from '@visactor/vrender-components';
export declare function escapeHTML(value: any): string;
export declare const getTooltipContentValue: <T>(field?: TooltipContentProperty<T>, datum?: any, params?: TooltipHandlerParams) => T;
export declare const getTooltipPatternValue: <T>(field?: MaybeArray<TooltipPatternProperty<T>>, data?: TooltipData, params?: TooltipHandlerParams) => MaybeArray<TooltipPatternProperty<T>> extends TooltipPatternProperty<T>[] ? MaybeArray<T> : T;
export declare function getFirstDatumFromTooltipData(data: TooltipData): Datum;
export declare function pickFirstValidValue<T>(isValid: (element?: T) => any, ...elements: T[]): T | undefined;
export declare function convertToColorString(color: any, defaultColor?: string): string;
export declare const getScale: (element: HTMLElement, boundingClientRect?: DOMRect) => number;
interface ITooltipTextInfo {
    width: number;
    height: number;
    text: MaybeArray<number> | MaybeArray<string> | TooltipRichTextAttrs;
}
export declare const measureTooltipText: (text: string | TooltipRichTextAttrs, style: ITooltipTextStyle) => ITooltipTextInfo;
export {};

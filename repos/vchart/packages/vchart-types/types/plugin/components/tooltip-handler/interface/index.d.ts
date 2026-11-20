import type { TooltipAttributes } from '@visactor/vrender-components';
import type { ITextAttribute, IFillStyle } from '@visactor/vrender-core';
export interface ITooltipTextStyle extends Partial<ITextAttribute & IFillStyle> {
    spacing?: number;
    multiLine?: boolean;
    maxWidth?: number;
    autoWidth?: boolean;
}
export interface ITooltipAttributes extends TooltipAttributes {
    align?: 'left' | 'right';
}
export interface ITooltipHandlerOptions {
    offsetX?: number;
    offsetY?: number;
}

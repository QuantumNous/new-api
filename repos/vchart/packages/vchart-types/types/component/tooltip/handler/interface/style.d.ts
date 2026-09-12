import type { ITextAttribute, IFillStyle, RichTextWordBreak } from '@visactor/vrender-core';
export interface ITooltipTextStyle extends Partial<ITextAttribute & IFillStyle> {
    spacing?: number;
    multiLine?: boolean;
    maxWidth?: number;
    wordBreak?: RichTextWordBreak;
    autoWidth?: boolean;
}

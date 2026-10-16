import type { ITooltipActual, Maybe } from '../../../../../typings';
import type { IDomTooltipStyle } from '../interface';
import type { ITooltipAttributes } from '../../interface';
export interface ITooltipModelOption {
    valueToHtml: (value: any) => string;
    getTooltipStyle: () => IDomTooltipStyle;
    getTooltipActual: () => Maybe<ITooltipActual>;
    getTooltipAttributes: () => Maybe<ITooltipAttributes>;
    getContainer: () => HTMLElement;
}

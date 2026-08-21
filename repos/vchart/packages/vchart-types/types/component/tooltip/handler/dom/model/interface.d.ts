import type { TooltipAttributes } from '@visactor/vrender-components';
import type { IToolTipActual, Maybe } from '../../../../../typings';
import type { IDomTooltipStyle } from '../interface';
export interface ITooltipModelOption {
    valueToHtml: (value: any) => string;
    getTooltipStyle: () => IDomTooltipStyle;
    getTooltipActual: () => Maybe<IToolTipActual>;
    getTooltipAttributes: () => Maybe<TooltipAttributes>;
}

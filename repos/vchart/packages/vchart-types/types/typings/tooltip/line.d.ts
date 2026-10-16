import type { TooltipContentProperty } from './common';
import type { ITooltipLabelActual, ITooltipLabelPattern } from './label';
import type { ITooltipShapeActual, ITooltipShapePattern } from './shape';
import type { TooltipRichTextAttrs } from '@visactor/vrender-components';
export interface ITooltipLinePattern extends ITooltipShapePattern, ITooltipLabelPattern {
    key?: TooltipContentProperty<string>;
    keyFormatter?: string;
    value?: TooltipContentProperty<string | TooltipRichTextAttrs>;
    valueFormatter?: string;
    visible?: TooltipContentProperty<boolean>;
    isKeyAdaptive?: TooltipContentProperty<boolean>;
    spaceRow?: TooltipContentProperty<number>;
    keyTimeFormat?: string;
    keyTimeFormatMode?: 'utc' | 'local';
    valueTimeFormat?: string;
    valueTimeFormatMode?: 'utc' | 'local';
}
export interface ITooltipLineActual extends ITooltipShapeActual, ITooltipLabelActual {
    key?: string;
    value?: string | TooltipRichTextAttrs;
    valueFormatter?: string;
    visible?: boolean;
    isKeyAdaptive?: boolean;
    spaceRow?: number;
    datum?: any;
}
export type TooltipActualTitleContent = {
    title?: ITooltipLineActual;
    content?: ITooltipLineActual[];
};

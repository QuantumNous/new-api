import { BaseTooltipModel } from './base-tooltip-model';
import type { ITooltipModelOption } from './interface';
import type { IShapeSvgOption } from './shape-model';
import type { IToolTipLineActual } from '../../../../../typings';
export type ContentColumnType = 'shape-box' | 'key-box' | 'value-box';
export declare class ContentColumnModel extends BaseTooltipModel {
    readonly className: ContentColumnType;
    constructor(parent: BaseTooltipModel | HTMLElement, option: ITooltipModelOption, className: ContentColumnType, childIndex?: number);
    init(): void;
    setStyle(): void;
    setContent(): void;
    protected _getContentColumnStyle(): import("../interface").TooltipColumnStyle<import("../interface").ILabelStyle> | {
        display?: string;
        marginLeft?: string;
        marginRight?: string;
        marginTop?: string;
        marginBottom?: string;
        width?: string;
        common?: import("../interface").IShapeStyle;
        items?: import("../interface").IShapeStyle[];
    };
    protected _getShapeSvgOption(line: IToolTipLineActual, index: number): IShapeSvgOption;
}

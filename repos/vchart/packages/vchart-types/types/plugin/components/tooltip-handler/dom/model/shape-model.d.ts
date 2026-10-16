import type { IGradientColor } from '@visactor/vrender-core';
import type { ShapeType } from '../../../../../typings';
import { BaseTooltipModel } from './base-tooltip-model';
export interface IShapeSvgOption {
    hasShape?: boolean;
    symbolType?: ShapeType | string;
    size?: string;
    fill?: string | IGradientColor;
    stroke?: string;
    lineWidth?: number;
    hollow?: boolean;
    marginTop?: string;
    index?: number;
}
export declare class ShapeModel extends BaseTooltipModel {
    svg: SVGElement;
    private _svgHtmlCache;
    init(classList?: string[], id?: string, tag?: keyof HTMLElementTagNameMap): void;
    setStyle(style?: Partial<CSSStyleDeclaration>, option?: IShapeSvgOption): void;
    setContent(option: IShapeSvgOption): void;
    setSvg(option?: IShapeSvgOption): void;
    release(): void;
}

import { ComponentTypeEnum } from '../../interface/type';
import { type MarkLineAttrs, MarkLine as MarkLineComponent } from '@visactor/vrender-components';
import type { IMarkProcessOptions } from '../interface';
import type { CoordinateType, IPoint } from '../../../typings';
import { BaseMarkLine } from './base-mark-line';
export declare class CartesianMarkLine extends BaseMarkLine {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static coordinateType: string;
    coordinateType: CoordinateType;
    static readonly builtInTheme: {
        markLine: import("./interface").IMarkLineTheme;
    };
    protected _markerComponent: MarkLineComponent;
    protected _newMarkLineComponent(attr: MarkLineAttrs): MarkLineComponent;
    protected _computePointsAttr(): {
        points: IPoint[];
    };
    protected _markerLayout(): void;
    protected _computeOptions(): IMarkProcessOptions;
}
export declare const registerMarkLine: () => void;

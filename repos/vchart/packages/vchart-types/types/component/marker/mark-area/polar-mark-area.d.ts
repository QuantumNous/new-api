import { ComponentTypeEnum } from '../../interface/type';
import type { MarkArcAreaAttrs, MarkAreaAttrs } from '@visactor/vrender-components';
import { MarkArcArea as MarkArcAreaComponent, MarkArea as MarkAreaComponent } from '@visactor/vrender-components';
import type { CoordinateType, IPoint, IPolarPoint } from '../../../typings';
import { BaseMarkArea } from './base-mark-area';
import type { IMarkProcessOptions } from '../interface';
export declare class PolarMarkArea extends BaseMarkArea {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static coordinateType: string;
    coordinateType: CoordinateType;
    static readonly builtInTheme: {
        polarMarkArea: import("./interface").IMarkAreaTheme;
    };
    protected _markerComponent: MarkArcAreaComponent;
    protected _newMarkAreaComponent(attr: MarkArcAreaAttrs | MarkAreaAttrs): MarkArcAreaComponent | MarkAreaComponent;
    protected _computePointsAttr(): {
        points?: IPoint[] | IPolarPoint[];
        innerRadius?: number;
        outerRadius?: number;
        startAngle?: number;
        endAngle?: number;
        center?: IPoint;
    };
    protected _computeOptions(): IMarkProcessOptions;
}
export declare const registerPolarMarkArea: () => void;

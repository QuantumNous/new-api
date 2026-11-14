import type { IPoint, StringOrNumber } from '../../../typings';
import type { IPolarAxis } from '../../axis/polar/interface';
export interface IPolarCrosshairInfo {
    x: number;
    y: number;
    center: IPoint;
    radius: number;
    distance: number;
    startAngle: number;
    endAngle: number;
    innerRadius: number;
    visible: boolean;
    sides: number;
    angle: number;
    point: IPoint;
    _isCache?: boolean;
    label?: IPolarCrosshairLabelInfo;
    axis?: IPolarAxis;
}
export interface IPolarCrosshairLabelInfo {
    visible: boolean;
    text: StringOrNumber;
    offset: number;
    defaultFormatter?: (value: StringOrNumber) => StringOrNumber;
}

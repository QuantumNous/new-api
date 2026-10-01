import type { StringOrNumber } from '../../../typings';
import type { IAxis } from '../../axis/interface';
export interface ICrosshairLabelInfo {
    visible: boolean;
    text: StringOrNumber;
    dx: number;
    dy: number;
    defaultFormatter?: (value: StringOrNumber) => StringOrNumber;
}
export interface ICrosshairInfoX {
    height: number;
    leftPos: number;
    rightPos: number;
    topPos: number;
    x: number;
    bottom: ICrosshairLabelInfo;
    top: ICrosshairLabelInfo;
    visible: boolean;
    _isCache?: boolean;
    axis: IAxis;
}
export interface ICrosshairInfoY {
    width: number;
    leftPos: number;
    topPos: number;
    bottomPos: number;
    y: number;
    left: ICrosshairLabelInfo;
    right: ICrosshairLabelInfo;
    visible: boolean;
    _isCache?: boolean;
    axis: IAxis;
}

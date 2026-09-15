import type { Dict } from '@visactor/vutils';
import type { IPadding, StringOrNumber } from '../../../typings';
import type { IAxis } from '../../axis/interface';
import type { LineCrosshair, RectCrosshair, Tag } from '@visactor/vrender-components';
import type { IGroup, IRichTextGraphicAttribute, IText, ITextGraphicAttribute } from '@visactor/vrender-core';
export type AxisCurrentValueMap = Map<number, {
    datum: StringOrNumber;
    axis: IAxis;
    [key: string]: any;
}>;
export type IBound = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
export type IAxisInfo<T> = Map<number, IBound & {
    axis: T;
}>;
export interface IHair {
    visible: boolean;
    type: 'rect' | 'line';
    style?: Dict<any>;
    label?: {
        visible: boolean;
        formatMethod?: (text: StringOrNumber | string[], position: string) => string | string[];
        formatter?: string | string[];
        textStyle?: Dict<any>;
        minWidth?: number;
        maxWidth?: number;
        padding?: IPadding | number | number[];
        panel?: Dict<any>;
        zIndex?: number;
        syncAxisLabelAngle?: boolean;
    };
    smooth?: boolean;
}
export interface IHairRadius extends IHair {
    smooth?: boolean;
}
export interface ICrosshairLabelInfo {
    visible: boolean;
    text: StringOrNumber;
    dx?: number;
    dy?: number;
    x?: number;
    y?: number;
    offset?: number;
    defaultFormatter?: (value: StringOrNumber) => StringOrNumber;
}
export interface ICrosshairInfo {
    coordRange: [number, number];
    sizeRange: [number, number];
    coord: number;
    labels: Record<string, ICrosshairLabelInfo>;
    labelsTextStyle?: Record<string, Partial<ITextGraphicAttribute> | Partial<IRichTextGraphicAttribute>>;
    visible: boolean;
    _isCache?: boolean;
    axis: IAxis;
    axisLabel?: IText;
    sides?: number;
}
export interface CrossHairStateItem {
    coordKey: string;
    anotherAxisKey: string;
    currentValue: AxisCurrentValueMap;
    attributes?: IHair | undefined;
    cacheInfo?: ICrosshairInfo | undefined;
    crosshairComp?: LineCrosshair | RectCrosshair | IGroup;
    labelsComp?: Record<string, Tag>;
    bandSize?: number;
    offsetSize?: number;
}
export type CrossHairStateByField = Record<string, CrossHairStateItem>;

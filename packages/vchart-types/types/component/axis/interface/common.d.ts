import type { IContinuousScale, IBaseScale, CustomTicksFunc } from '@visactor/vscale';
import type { CoordinateType, Datum, IPolarOrientType, StringOrNumber } from '../../../typings';
import type { IComponent } from '../../interface/common';
import type { ICartesianAxisSpec } from '../cartesian/interface';
import type { ITextGraphicAttribute } from '@visactor/vrender-core';
export interface StatisticsDomain {
    domain: any[];
    index: {
        [key in StringOrNumber]: number;
    };
}
export interface IAxis extends IComponent {
    valueToPosition: (value: any) => number;
    getScale: () => IBaseScale;
    getScales: () => IBaseScale[];
    getOrient: () => ICartesianAxisSpec['orient'] | IPolarOrientType;
    getInverse: () => boolean;
    getCoordinateType: () => CoordinateType;
    visible: boolean;
    directionStr?: 'l2r' | 'r2l' | 't2b' | 'b2t';
    updateScaleRange?: () => void;
}
export interface IAxisItem<T> {
    visible?: boolean;
    style?: Omit<T, 'visible'>;
}
export interface IAxisItemTheme<T> {
    visible?: boolean;
    style?: Omit<T, 'visible'>;
}
export type AxisAnimationPreset = 'groupFadeIn' | 'fadeIn' | 'grow';
export type ITickCallbackOption = {
    axisLength?: number;
    labelStyle?: ITextGraphicAttribute;
};
export type StyleCallback<T> = (value: any, index: number, datum: Datum, data: Datum[]) => T;
export type AxisType = 'linear' | 'ordinal' | 'band' | 'point' | 'time' | 'log' | 'symlog';
export interface IAxisLocationCfg {
    bandPosition?: number;
    datum?: Datum;
}
export interface ITickCalculationCfg {
    tickStep?: number;
    tickCount?: number | ((option: ITickCallbackOption) => number);
    forceTickCount?: number;
    tickMode?: 'average' | 'd3' | CustomTicksFunc<IContinuousScale>;
    noDecimals?: boolean;
}
export interface IBandAxisLayer extends Omit<ITickCalculationCfg, 'noDecimals' | 'tickMode'> {
    visible?: boolean;
}
export declare enum AxisEnum {
    lineAxis = "lineAxis",
    circleAxis = "circleAxis"
}
export declare enum GridEnum {
    lineAxisGrid = "lineAxisGrid",
    circleAxisGrid = "circleAxisGrid"
}

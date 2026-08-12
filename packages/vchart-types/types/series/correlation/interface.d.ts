import type { IMarkTheme, IMarkSpec, ISymbolMarkSpec, IRippleMarkSpec } from '../../typings';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IPolarSeriesSpec } from '../polar/interface';
import type { IAnimationSpec } from '../../animation/spec';
export type CorrelationMarks = 'point' | 'label';
export type CorrelationAppearPreset = 'scaleIn' | 'fadeIn';
export interface ICorrelationAnimationParams {
    [key: string]: object;
}
export interface ICorrelationSeriesSpec extends Omit<IPolarSeriesSpec, 'innerRadius' | 'outerRadius'>, IAnimationSpec<CorrelationMarks, CorrelationAppearPreset> {
    type: 'correlation';
    categoryField: string;
    valueField: string;
    seriesField?: string;
    sizeField?: string;
    sizeRange?: number[];
    centerX?: number;
    centerY?: number;
    innerRadius?: string | number;
    outerRadius?: string | number;
    startAngle?: number;
    endAngle?: number;
    [SeriesMarkNameEnum.centerPoint]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.ripplePoint]?: IMarkSpec<IRippleMarkSpec>;
    [SeriesMarkNameEnum.centerLabel]?: ILabelSpec & {
        position?: 'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
    };
    [SeriesMarkNameEnum.nodePoint]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILabelSpec & {
        position?: 'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
    }>;
}
export interface ICorrelationSeriesTheme {
    [SeriesMarkNameEnum.nodePoint]?: IMarkTheme<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.ripplePoint]?: IMarkTheme<IRippleMarkSpec>;
    [SeriesMarkNameEnum.centerPoint]?: IMarkTheme<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.centerLabel]?: ILabelSpec;
    [SeriesMarkNameEnum.label]?: ILabelSpec;
}

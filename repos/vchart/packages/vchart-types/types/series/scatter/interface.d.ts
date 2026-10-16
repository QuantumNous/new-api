import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ISymbolMarkSpec, IVisualSpecBase, ShapeType, FunctionType } from '../../typings';
import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILineLikeLabelSpec } from '../mixin/interface';
import type { IMultiLabelSpec } from '../../component/label/interface';
export type ScatterMarks = 'point' | 'label';
export type ScatterAppearPreset = 'scaleIn' | 'fadeIn';
export interface IScatterAnimationParams {
    [key: string]: object;
}
export interface IScatterSeriesSpec extends ICartesianSeriesSpec, IAnimationSpec<ScatterMarks, ScatterAppearPreset>, IMarkProgressiveConfig {
    type: 'scatter';
    xField?: string | string[];
    yField?: string | string[];
    [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
    sizeField?: string;
    size?: number | number[] | FunctionType<number> | IVisualSpecBase<unknown, number>;
    shapeField?: string;
    shape?: ShapeType | ShapeType[] | FunctionType<ShapeType> | IVisualSpecBase<unknown, ShapeType>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILineLikeLabelSpec>;
}
export interface IScatterSeriesTheme extends ICartesianSeriesTheme {
    size?: number;
    shape?: ShapeType;
    [SeriesMarkNameEnum.point]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
}

import type { Datum, IMarkSpec, IMarkTheme, ISeriesSpec, IOrientType, IPathMarkSpec, IPolygonMarkSpec, IRuleMarkSpec, ITextMarkSpec, IPercent, IComposedTextMarkSpec, IFormatMethod } from '../../typings';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';
type FunnelMarks = 'funnel';
export type FunnelAppearPreset = 'clipIn' | 'fadeIn';
export interface IFunnelSeriesSpec extends ISeriesSpec, IAnimationSpec<FunnelMarks, FunnelAppearPreset> {
    type: 'funnel';
    categoryField: string;
    valueField: string;
    funnelOrient?: IOrientType;
    shape?: 'rect' | 'trapezoid';
    isTransform?: boolean;
    isCone?: boolean;
    funnelAlign?: 'left' | 'center' | 'right';
    gap?: number;
    range?: {
        min?: number;
        max?: number;
    };
    maxSize?: number | IPercent;
    minSize?: number | IPercent;
    heightRatio?: number;
    transformRatioText?: string;
    [SeriesMarkNameEnum.funnel]?: IMarkSpec<IPathMarkSpec>;
    [SeriesMarkNameEnum.transform]?: IMarkSpec<IPathMarkSpec>;
    [SeriesMarkNameEnum.label]?: IFunnelLabelSpec;
    [SeriesMarkNameEnum.outerLabel]?: IFunnelOuterLabelSpec;
    [SeriesMarkNameEnum.transformLabel]?: IFunnelLabelSpec;
}
interface IFunnelLabelSpec extends Omit<ILabelSpec, 'position' | 'offset'> {
    limit?: 'shapeSize' | number;
}
export interface IFunnelOuterLabelSpec extends IMarkSpec<IComposedTextMarkSpec> {
    formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>;
    position?: 'left' | 'right' | 'top' | 'bottom';
    spaceWidth?: number;
    alignLabel?: boolean;
    style?: ITextMarkSpec;
    line?: {
        minLength?: number;
    } & IMarkSpec<IRuleMarkSpec>;
}
export interface IFunnelSeriesTheme {
    [SeriesMarkNameEnum.funnel]?: Partial<IMarkTheme<IPolygonMarkSpec>>;
    [SeriesMarkNameEnum.transform]?: Partial<IMarkTheme<IPolygonMarkSpec>>;
    [SeriesMarkNameEnum.label]?: Partial<IMarkTheme<ITextMarkSpec>>;
    [SeriesMarkNameEnum.outerLabel]?: Partial<IMarkTheme<ITextMarkSpec>> & {
        line?: Partial<IMarkTheme<IRuleMarkSpec>>;
    };
    [SeriesMarkNameEnum.transformLabel]?: Partial<IMarkTheme<ITextMarkSpec>>;
}
export {};

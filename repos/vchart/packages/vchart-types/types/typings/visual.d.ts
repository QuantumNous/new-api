import type { PopTipAttributes } from '@visactor/vrender-components';
import type { DataView } from '@visactor/vdataset';
import type { Cursor } from './cursor';
import type { InterpolateType } from './interpolate';
import type { ScaleType } from './scale';
import type { ShapeType } from './shape';
import type { IPoint } from './coordinate';
import type { IModelMarkAttributeContext } from '../compile/mark/interface';
import type { Datum } from './common';
import type { IPadding } from '@visactor/vutils';
import type { IColorKey } from '../theme/color-scheme/interface';
import type { ITokenKey } from '../theme/token/interface';
import type { IRepeatType, TextAlignType, TextBaselineType, IRichTextAttribute, IGraphicStyle, IColor } from '@visactor/vrender-core';
export interface IVisualSpecBase<D, T> {
    type: ScaleType;
    domain: D[];
    range: T[];
    specified?: {
        [key: string]: unknown;
    };
    clamp?: boolean;
}
export interface IVisualSpecStyle<D, T> extends IVisualSpecBase<D, T> {
    field?: string;
}
export type IDataDomainSpec = {
    dataId: string;
    fields: string[];
};
export interface IVisualSpecScale<D, T> extends Omit<IVisualSpecBase<D, T>, 'domain'> {
    id: string;
    domain: IVisualSpecBase<D, T>['domain'] | IDataDomainSpec[];
}
export type IVisual<D = any, R = any> = IVisualSpecStyle<D, R> | IVisualScale;
export interface IVisualScale {
    scale: string;
    field?: string;
    changeDomain?: 'none' | 'replace' | 'expand';
}
export type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
export type ValueType<T> = T;
export type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
export type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
export type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
    [key in keyof T]: VisualType<T[key]>;
};
export interface IBorder {
    distance: number | string;
    stroke?: string | IGradient;
    strokeOpacity?: number;
    lineWidth?: number;
    lineDash?: number[];
    lineDashOffset?: number;
}
export interface ICommonSpec {
    visible?: boolean;
    x?: number;
    y?: number;
    z?: number;
    stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null;
    strokeOpacity?: number;
    opacity?: number;
    lineWidth?: number;
    lineDash?: number[];
    lineDashOffset?: number;
    cursor?: Cursor;
    zIndex?: number;
    angle?: number;
    anchor?: [number, number];
    scaleX?: number;
    scaleY?: number;
    scaleCenter?: [number | string, number | string];
    alpha?: number;
    beta?: number;
    anchor3d?: [number, number];
    pickMode?: 'accurate' | 'imprecise' | 'custom';
    boundsMode?: 'accurate' | 'imprecise';
    pickStrokeBuffer?: number;
    texture?: TextureType | string;
    textureColor?: string;
    textureSize?: number;
    texturePadding?: number;
    outerBorder?: IBorder;
    innerBorder?: IBorder;
    html?: IMarkHtmlSpec;
    [key: string]: any;
}
export type BackgroundSizing = 'cover' | 'contain' | 'fill' | 'auto';
export type BackgroundRepeatMode = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
export type BackgroundSizingShorthand = 'no-repeat-cover' | 'no-repeat-contain' | 'no-repeat-fill' | 'no-repeat-auto';
export type BackgroundMode = BackgroundRepeatMode | BackgroundSizingShorthand;
export type BackgroundPositionHorizontalKeyword = 'left' | 'center' | 'right';
export type BackgroundPositionVerticalKeyword = 'top' | 'center' | 'bottom';
export type BackgroundPositionKeyword = BackgroundPositionHorizontalKeyword | BackgroundPositionVerticalKeyword;
export type BackgroundPositionPercent = `${number}%`;
export type BackgroundPositionValue = number | BackgroundPositionKeyword | BackgroundPositionPercent;
export type BackgroundPositionPreset = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type BackgroundPosition = BackgroundPositionKeyword | BackgroundPositionPreset | [BackgroundPositionValue, BackgroundPositionValue];
export type ImageMode = BackgroundSizing;
export interface IFillMarkSpec extends ICommonSpec {
    fill?: VisualType<string> | IGradient | false | IColorKey;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    fillOpacity?: number;
    background?: IColor | HTMLImageElement | HTMLCanvasElement | null;
    backgroundMode?: BackgroundMode;
    backgroundFit?: boolean;
    backgroundKeepAspectRatio?: boolean;
    backgroundScale?: number;
    backgroundOffsetX?: number;
    backgroundOffsetY?: number;
    backgroundPosition?: BackgroundPosition;
    backgroundClip?: boolean;
    backgroundCornerRadius?: number | number[];
    backgroundOpacity?: number;
}
export type IMarkHtmlSpec = Partial<IGraphicStyle['html']>;
export interface ISymbolMarkSpec extends IFillMarkSpec {
    dx?: number;
    dy?: number;
    size?: number | number[];
    shape?: ShapeType | string;
    symbolType?: ShapeType | string;
    scaleX?: number;
    scaleY?: number;
}
export interface ILineLikeMarkSpec extends IFillMarkSpec {
    curveType?: InterpolateType;
    defined?: boolean;
}
export interface IAreaMarkSpec extends ILineLikeMarkSpec {
    x1?: number;
    y1?: number;
    orient?: 'horizontal' | 'vertical';
}
export interface ILineMarkSpec extends ILineLikeMarkSpec {
    lineCap?: LineStrokeCap;
    lineJoin?: LineStrokeJoin;
    miterLimit?: number;
    strokeBoundsBuffer?: number;
}
export interface IRuleMarkSpec extends ILineMarkSpec {
    x1?: number;
    y1?: number;
}
export interface ITextMarkSpec extends IFillMarkSpec {
    text?: string | number | string[] | number[];
    dx?: number;
    dy?: number;
    fontSize?: number | ITokenKey;
    textAlign?: TextAlign;
    textBaseline?: TextBaseLine;
    fontFamily?: string;
    fontWeight?: FontWeight;
    fontStyle?: FontStyle;
    maxLineWidth?: number;
    ellipsis?: string;
    suffixPosition?: 'start' | 'end' | 'middle';
    underline?: boolean;
    underlineDash?: number[];
    underlineOffset?: number;
    lineThrough?: boolean;
    lineHeight?: number | string | ITokenKey;
    poptip?: PopTipAttributes;
    direction?: 'horizontal' | 'vertical';
    wordBreak?: 'break-word' | 'break-all' | 'keep-all';
    heightLimit?: number;
    lineClamp?: number;
    whiteSpace?: 'normal' | 'no-wrap';
}
export type IRichTextMarkSpec = IRichTextAttribute & IFillMarkSpec & {
    type: 'rich';
    text: IRichTextAttribute['textConfig'];
};
export type IComposedTextMarkSpec = ITextMarkSpec | IRichTextMarkSpec;
export type IPositionedTextMarkSpec = Omit<ITextMarkSpec, 'align' | 'textAlign' | 'baseline' | 'textBaseline'>;
export interface IRectMarkSpec extends IFillMarkSpec {
    cornerRadius?: number | number[];
    width?: number;
    height?: number;
    x1?: number;
    y1?: number;
}
export interface IBoxPlotMarkSpec extends ICommonSpec {
    min?: (datum: Datum) => number;
    q1?: (datum: Datum) => number;
    median?: (datum: Datum) => number;
    q3?: (datum: Datum) => number;
    max?: (datum: Datum) => number;
    shaftShape?: BoxPlotShaftShape;
    boxWidth?: number | string;
    boxHeight?: number | string;
    shaftWidth?: number | string;
    ruleWidth?: number | string;
    ruleHeight?: number | string;
    minMaxWidth?: number | string;
    minMaxHeight?: number | string;
    q1q3Width?: number | string;
    q1q3Height?: number | string;
    lineWidth?: number;
    minMaxFillOpacity?: number;
    boxStroke?: string;
    medianStroke?: string;
    boxCornerRadius?: number;
}
export interface IRippleMarkSpec extends ICommonSpec {
    ripple?: number;
    size?: number;
}
export interface ILiquidMarkSpec extends ICommonSpec {
    wave?: number;
}
export interface ILiquidOutlineSpec extends ISymbolMarkSpec {
    lineWidth: number;
}
export interface IOutlierMarkSpec {
    fill?: string;
    size?: number;
}
export interface IPathMarkSpec extends IFillMarkSpec {
    path?: string;
    smoothScale?: boolean;
}
export interface ILinkPathMarkSpec extends IFillMarkSpec {
    x0?: number;
    y0?: number;
    x1?: number;
    y1?: number;
    thickness?: number;
    curvature?: number;
    round?: boolean;
    ratio?: number;
    align?: 'start' | 'end' | 'center';
    pathType?: 'line' | 'smooth' | 'polyline';
    endArrow?: boolean;
    startArrow?: boolean;
    backgroundStyle?: any;
    direction?: 'horizontal' | 'vertical' | 'LR' | 'RL' | 'TB' | 'BL' | 'radial';
}
export interface IArcMarkSpec extends IFillMarkSpec {
    startAngle?: number;
    endAngle?: number;
    padAngle?: number;
    outerRadius?: number;
    innerRadius?: number;
    cornerRadius?: number;
    innerPadding?: number;
    outerPadding?: number;
    centerOffset?: number;
    cap?: boolean | [boolean, boolean];
    autoCapConical?: boolean;
}
export interface ICellMarkSpec extends ISymbolMarkSpec {
    padding?: number | number[] | IPadding;
}
export interface IGroupMarkSpec extends IFillMarkSpec {
    clip?: boolean;
    width?: number;
    height?: number;
    cornerRadius?: number | number[];
}
export interface IPolygonMarkSpec extends ICommonSpec, IFillMarkSpec {
    points?: IPoint[];
    cornerRadius?: number | number[];
    scaleX?: number;
    scaleY?: number;
}
export type RepeatType = 'no-repeat' | 'repeat-x' | 'repeat-y' | 'repeat';
export type RepeatXYType = 'no-repeat' | 'repeat' | 'stretch';
export type ImageOriginType = 'top' | 'bottom';
export type GradientPropValue<T> = ValueType<T> | FunctionType<T>;
export type GradientStop = {
    offset: GradientPropValue<number>;
    color?: GradientPropValue<string>;
    opacity?: number;
};
export interface IGradientLinear {
    x0?: GradientPropValue<number>;
    y0?: GradientPropValue<number>;
    x1?: GradientPropValue<number>;
    y1?: GradientPropValue<number>;
    stops: GradientStop[];
    gradient: 'linear';
}
export interface IGradientRadial {
    r0?: GradientPropValue<number>;
    x0?: GradientPropValue<number>;
    y0?: GradientPropValue<number>;
    x1?: GradientPropValue<number>;
    y1?: GradientPropValue<number>;
    r1?: GradientPropValue<number>;
    stops: GradientStop[];
    gradient: 'radial';
}
export interface IGradientConical {
    x?: GradientPropValue<number>;
    y?: GradientPropValue<number>;
    startAngle?: GradientPropValue<number>;
    endAngle?: GradientPropValue<number>;
    stops: GradientStop[];
    gradient: 'conical';
}
export type GradientType = 'linear' | 'radial' | 'conical';
export type IGradient = IGradientLinear | IGradientRadial | IGradientConical;
export type LineStrokeCap = 'butt' | 'round' | 'square';
export type LineStrokeJoin = 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round';
export type BoxPlotShaftShape = 'line' | 'bar' | 'filled-line';
export interface IThresholdStyle extends IVisualSpecStyle<number, string> {
    domain: number[];
    field: string;
    range: string[];
    type: 'threshold';
}
export interface IUnknownMarkSpec extends ICommonSpec {
    [key: string]: unknown;
}
export interface IImageMarkSpec extends IFillMarkSpec {
    cornerRadius?: number | number[];
    width?: number;
    height?: number;
    repeatX?: IRepeatType;
    repeatY?: IRepeatType;
    imageMode?: ImageMode;
    imagePosition?: BackgroundPosition;
    imageScale?: number;
    imageOffsetX?: number;
    imageOffsetY?: number;
    image?: string | HTMLImageElement | HTMLCanvasElement;
}
export type TextAlign = TextAlignType;
export type TextBaseLine = TextBaselineType;
export type FontStyle = 'normal' | 'italic' | 'oblique' | string;
export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

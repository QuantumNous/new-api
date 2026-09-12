import type { ITextMarkSpec, IMarkSpec, ISeriesSpec, ITextFormatMethod, IRectMarkSpec } from '../../typings';
import type { IAnimationSpec, IMarkAnimateSpec, IStateAnimateSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { shapes, GeometricMaskShape, TextShapeMask } from '@visactor/vlayouts';
import type { IAnimationTypeConfig } from '../../animation/interface';
export interface IWordcloudAnimationParams {
    animationConfig: () => IAnimationTypeConfig;
}
export type WordcloudAppearPreset = 'scaleIn' | 'fadeIn';
export type WordCloudShapeType = keyof typeof shapes;
export type EllipsisType = {
    string?: string;
    limitLength?: number;
};
export type ZoomToFitType = {
    repeat?: boolean;
    shrink?: boolean;
    enlarge?: boolean;
    fontSizeLimitMin?: number;
    fontSizeLimitMax?: number;
};
export type DrawOutOfBoundType = 'clip' | 'hidden' | 'ellipsis';
export type WordCloudConfigType = {
    drawOutOfBound?: DrawOutOfBoundType;
    ellipsis?: EllipsisType;
    layoutMode?: 'fast' | 'grid' | 'default';
    zoomToFit: ZoomToFitType;
    progressiveTime?: number;
    progressiveStep?: number;
};
export type WordCloudShapeConfigType = {
    fillingSeriesField?: string;
    fillingColorList?: string[];
    fillingFontFamilyField?: string;
    fillingFontWeightField?: string;
    fillingFontStyleField?: string;
    fillingColorHexField?: string;
    fillingRotateAngles?: number[];
    ratio?: number;
    removeWhiteBorder?: boolean;
    layoutMode?: 'default' | 'ensureMapping' | 'ensureMappingEnlarge';
    fillingTimes?: number;
    fillingXStep?: number;
    fillingYStep?: number;
    fillingXRatioStep?: number;
    fillingYRatioStep?: number;
    fillingInitialFontSize?: number;
    fillingDeltaFontSize?: number;
    fillingInitialOpacity?: number;
    fillingDeltaOpacity?: number;
    textLayoutTimes?: number;
    fontSizeShrinkFactor?: number;
    stepFactor?: number;
    importantWordCount?: number;
    globalShinkLimit?: number;
    fontSizeEnlargeFactor?: number;
    fillingDeltaFontSizeFactor?: number;
    fillingRatio?: number;
};
export interface IWordCloudSeriesBaseSpec extends ISeriesSpec, IAnimationSpec<SeriesMarkNameEnum.word, WordcloudAppearPreset> {
    nameField: string;
    valueField?: string;
    fontFamilyField?: string;
    fontWeightField?: string;
    fontStyleField?: string;
    colorHexField?: string;
    colorMode?: 'ordinal';
    colorList?: string[];
    rotateAngles?: number[];
    fontWeightRange?: [number, number];
    fontSizeRange?: [number, number] | 'auto';
    maskShape?: string | WordCloudShapeType | TextShapeMask | GeometricMaskShape;
    keepAspect?: boolean;
    random?: boolean;
    wordCloudConfig?: WordCloudConfigType;
    wordCloudShapeConfig?: WordCloudShapeConfigType;
    [SeriesMarkNameEnum.word]?: IMarkSpec<ITextMarkSpec> & {
        padding?: number;
        formatMethod?: ITextFormatMethod<[datum?: any]>;
    };
    [SeriesMarkNameEnum.fillingWord]?: IMarkSpec<ITextMarkSpec> & {
        padding?: number;
    };
    [SeriesMarkNameEnum.wordMask]?: IMarkSpec<IRectMarkSpec>;
    animationAppear?: boolean | (IStateAnimateSpec<WordcloudAppearPreset> & {
        duration?: number;
        totalTime?: number;
    }) | IMarkAnimateSpec<string>;
}
export interface IWordCloudSeriesSpec extends IWordCloudSeriesBaseSpec {
    type: 'wordCloud';
}
export interface IWordCloudSeriesTheme {
    [SeriesMarkNameEnum.word]?: IMarkSpec<ITextMarkSpec> & {
        padding?: number;
    };
    [SeriesMarkNameEnum.fillingWord]?: IMarkSpec<ITextMarkSpec> & {
        padding?: number;
    };
}

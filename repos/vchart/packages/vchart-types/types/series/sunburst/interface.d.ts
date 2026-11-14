import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec';
import type { SunburstLabelConfig } from '@visactor/vlayouts';
import type { SunburstAppearPreset, SunburstMark } from './animation/interface';
import type { IArcMarkSpec, ITextMarkSpec } from '../../typings';
import type { IPolarSeriesTheme } from '../polar/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
export interface ISunburstSeriesSpec extends Omit<ISeriesSpec, 'data'>, IAnimationSpec<SunburstMark, SunburstAppearPreset> {
    type: 'sunburst';
    categoryField: string;
    valueField: string;
    centerX?: number;
    centerY?: number;
    offsetX?: number;
    offsetY?: number;
    startAngle?: number;
    endAngle?: number;
    innerRadius?: number | number[];
    outerRadius?: number | number[];
    gap?: number | number[];
    labelLayout?: SunburstLabelConfig | (SunburstLabelConfig | null)[];
    labelAutoVisible?: LabelAutoVisibleType;
    drill?: boolean;
    drillField?: string;
    [SeriesMarkNameEnum.label]?: IMarkSpec<ITextMarkSpec>;
    [SeriesMarkNameEnum.sunburst]?: IMarkSpec<IArcMarkSpec>;
}
export interface ISunburstSeriesTheme extends Omit<IPolarSeriesTheme, 'label' | 'innerRadius' | 'outerRadius'> {
    startAngle?: number;
    endAngle?: number;
    innerRadius?: number | number[];
    outerRadius?: number | number[];
    gap?: number | number[];
    labelLayout?: SunburstLabelConfig | SunburstLabelConfig[];
    [SeriesMarkNameEnum.label]?: IMarkTheme<ITextMarkSpec>;
    [SeriesMarkNameEnum.sunburst]?: IMarkTheme<IArcMarkSpec>;
}
export type LabelAutoVisibleType = {
    enable?: boolean;
    circumference?: number;
};

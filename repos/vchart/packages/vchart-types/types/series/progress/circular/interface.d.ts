import type { IAnimationSpec } from '../../../animation/spec';
import type { IMarkSpec, IMarkTheme } from '../../../typings/spec/common';
import type { IProgressSeriesSpec } from '../interface';
import type { IProgressLikeSeriesSpec, IProgressLikeSeriesTheme, ProgressLikeAppearPreset } from '../../polar/progress-like/interface';
import type { SeriesMarkNameEnum } from '../../interface/type';
import type { IArcMarkSpec } from '../../../typings';
export type CircularProgressMarks = 'progress' | 'track';
export interface ICircularProgressSeriesSpec extends IProgressSeriesSpec, IProgressLikeSeriesSpec, IAnimationSpec<CircularProgressMarks, ProgressLikeAppearPreset> {
    type: 'circularProgress';
    categoryField?: string | string[];
    radiusField?: string;
    maxValue?: number;
    [SeriesMarkNameEnum.progress]?: IMarkSpec<IArcMarkSpec>;
    [SeriesMarkNameEnum.track]?: IMarkSpec<IArcMarkSpec>;
}
export interface ICircularProgressSeriesTheme extends IProgressLikeSeriesTheme {
    [SeriesMarkNameEnum.progress]?: Partial<IMarkTheme<IArcMarkSpec>>;
    [SeriesMarkNameEnum.track]?: Partial<IMarkTheme<IArcMarkSpec>>;
}

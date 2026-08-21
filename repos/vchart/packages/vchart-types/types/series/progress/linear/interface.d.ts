import type { IAnimationSpec } from '../../../animation/spec';
import type { DirectionType } from '../../../typings';
import type { IMarkSpec, IMarkTheme } from '../../../typings/spec/common';
import type { IRectMarkSpec } from '../../../typings/visual';
import type { SeriesMarkNameEnum } from '../../interface/type';
import type { IProgressSeriesSpec } from '../interface';
export interface ILinearProgressAnimationParams {
    direction: DirectionType;
}
export type LinearProgressAppearPreset = 'grow' | 'fadeIn';
export interface ILinearProgressSeriesSpec extends IProgressSeriesSpec, IAnimationSpec<SeriesMarkNameEnum.progress | SeriesMarkNameEnum.track, LinearProgressAppearPreset> {
    type: 'linearProgress';
    xField: string | string[];
    yField: string | string[];
    direction?: DirectionType;
    bandWidth?: number;
    clamp?: boolean;
    [SeriesMarkNameEnum.progress]?: IMarkSpec<IRectMarkSpec> & {
        topPadding?: number;
        bottomPadding?: number;
        leftPadding?: number;
        rightPadding?: number;
    };
    [SeriesMarkNameEnum.track]?: IMarkSpec<IRectMarkSpec>;
}
export interface ILinearProgressSeriesTheme {
    bandWidth?: number;
    [SeriesMarkNameEnum.progress]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.track]?: Partial<IMarkTheme<IRectMarkSpec>>;
}

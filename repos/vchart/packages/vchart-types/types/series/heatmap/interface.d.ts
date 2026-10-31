import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IRectMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec } from '../../component/label/interface';
import type { IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
export type HeatmapAppearPreset = 'fadeIn';
type HeatmapMarks = 'cell' | 'background' | 'label';
export interface IHeatmapSeriesSpec extends ICartesianSeriesSpec, IAnimationSpec<HeatmapMarks, HeatmapAppearPreset>, IMarkProgressiveConfig {
    type: 'heatmap';
    valueField?: string;
    [SeriesMarkNameEnum.cell]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.cellBackground]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.label]?: ILabelSpec & {
        position?: 'inside' | 'inside-top' | 'inside-bottom' | 'inside-right' | 'inside-left';
    };
}
export interface IHeatmapSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.cell]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.cellBackground]?: Partial<IMarkTheme<IRectMarkSpec>>;
}
export {};

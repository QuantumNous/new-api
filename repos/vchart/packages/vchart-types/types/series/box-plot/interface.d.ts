import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkProgressiveConfig } from '../../mark/interface';
import type { DirectionType, IBoxPlotMarkSpec, IOutlierMarkSpec, IMarkSpec, IMarkTheme, ISymbolMarkSpec } from '../../typings';
import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
export interface IBoxPlotSeriesSpec extends Omit<ICartesianSeriesSpec, 'xField' | 'yField' | 'direction'>, IAnimationSpec<SeriesMarkNameEnum.boxPlot, string>, IMarkProgressiveConfig {
    type: 'boxPlot';
    direction?: DirectionType;
    xField?: string | string[];
    yField?: string | string[];
    minField?: string;
    maxField?: string;
    q1Field?: string;
    medianField?: string;
    q3Field?: string;
    outliersField?: string;
    [SeriesMarkNameEnum.boxPlot]?: IMarkSpec<IBoxPlotMarkSpec>;
    [SeriesMarkNameEnum.outlier]?: IMarkSpec<ISymbolMarkSpec>;
    outliersStyle?: IOutlierMarkSpec;
    boxWidth?: number | string;
    boxMinWidth?: number | string;
    boxMaxWidth?: number | string;
    boxGapInGroup?: number | string | (number | string)[];
}
export interface IBoxPlotSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.boxPlot]?: Partial<IMarkTheme<IBoxPlotMarkSpec>>;
}

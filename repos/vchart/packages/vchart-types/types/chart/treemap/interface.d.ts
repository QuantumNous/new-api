import type { ITreemapSeriesSpec } from '../../series/treemap/interface';
import type { IChartSpec } from '../../typings/spec/common';
export interface ITreemapChartSpec extends Omit<IChartSpec, 'data' | 'series'>, Omit<ITreemapSeriesSpec, 'tooltip'> {
    type: 'treemap';
    series?: ITreemapSeriesSpec[];
}

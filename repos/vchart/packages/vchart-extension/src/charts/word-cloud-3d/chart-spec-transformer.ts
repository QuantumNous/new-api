import { BaseWordCloudChartSpecTransformer, type AdaptiveSpec } from '@visactor/vchart';
import type { IWordCloud3dChartSpec } from './interface';

export class WordCloud3dChartSpecTransformer<
  T extends IWordCloud3dChartSpec = IWordCloud3dChartSpec
> extends BaseWordCloudChartSpecTransformer<AdaptiveSpec<T, 'type' | 'series'>> {
  protected _getDefaultSeriesSpec(spec: IWordCloud3dChartSpec): any {
    const series: any = super._getDefaultSeriesSpec(spec as any);
    series.depth_3d = spec.depth_3d;

    return series;
  }
}

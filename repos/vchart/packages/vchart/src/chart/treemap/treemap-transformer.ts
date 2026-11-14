import type { AdaptiveSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { ITreemapChartSpec } from './interface';

export class TreemapChartSpecTransformer<
  T extends ITreemapChartSpec = ITreemapChartSpec
> extends BaseChartSpecTransformer<AdaptiveSpec<T, 'data' | 'series'>> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'aspectRatio',
      'splitType',
      'maxDepth',
      'gapWidth',
      'nodePadding',
      'minVisibleArea',
      'minChildrenVisibleArea',
      'minChildrenVisibleSize',
      'roam',
      'drill',
      'drillField',
      'leaf',
      'nonLeaf',
      'nonLeafLabel'
    ]);
    return series;
  }

  transformSpec(spec: any): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}

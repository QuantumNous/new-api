import type { ISeriesSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { ISankeyChartSpec } from './interface';

export class SankeyChartSpecTransformer<
  T extends ISankeyChartSpec = ISankeyChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'sourceField',
      'targetField',
      'direction',
      'nodeAlign',
      'crossNodeAlign',
      'nodeGap',
      'nodeWidth',
      'linkWidth',
      'minStepWidth',
      'minNodeHeight',
      'maxNodeHeight',
      'minLinkHeight',
      'maxLinkHeight',
      'dropIsolatedNode',
      'nodeHeight',
      'linkHeight',
      'equalNodeHeight',
      'linkOverlap',
      'iterations',
      'nodeKey',
      'linkSortBy',
      'nodeSortBy',
      'setNodeLayer',
      'node',
      'link',
      'emphasis',
      'inverse',
      'overflow'
    ]);

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}

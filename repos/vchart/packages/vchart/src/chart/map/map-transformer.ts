import type { IMapSeriesSpec } from '../../series';
// eslint-disable-next-line no-duplicate-imports
import { SeriesTypeEnum } from '../../series';
import type { RegionSpec, ISeriesSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { IMapChartSpec } from './interface';

export class MapChartSpecTransformer<T extends IMapChartSpec = IMapChartSpec> extends BaseChartSpecTransformer<T> {
  protected _isValidSeries(type: string) {
    return type === SeriesTypeEnum.map;
  }

  protected _getDefaultSeriesSpec(spec: IMapChartSpec): IMapSeriesSpec {
    return super._getDefaultSeriesSpec(spec, [
      'type',
      'nameField',
      'valueField',
      'map',
      'nameProperty',
      'centroidProperty',
      'nameMap',
      'area',
      'defaultFillColor',
      'showDefaultName'
    ]);
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);

    spec.region.forEach((r: RegionSpec) => {
      r.coordinate = 'geo';
    });

    super.transformSeriesSpec(spec);
  }
}

// eslint-disable-next-line no-duplicate-imports

import type { RegionSpec } from '@visactor/vchart';
import { BaseChartSpecTransformer } from '@visactor/vchart';
import type { IPictogramChartSpec } from './interface';
import { PICTOGRAM_SERIES_TYPE } from './series/constant';
import type { IPictogramSeriesSpec } from './series/interface';

export class PictogramChartSpecTransformer<
  T extends IPictogramChartSpec = IPictogramChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _isValidSeries(type: string) {
    return type === PICTOGRAM_SERIES_TYPE;
  }

  protected _getDefaultSeriesSpec(spec: IPictogramChartSpec): IPictogramSeriesSpec {
    return super._getDefaultSeriesSpec(spec, [
      'type',
      'nameField',
      'valueField',
      'svg',
      'pictogram',
      'defaultFillColor'
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

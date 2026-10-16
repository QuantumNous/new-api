import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IBoxPlotSeriesSpec, IBoxPlotSeriesTheme } from './interface';

export class BoxPlotSeriesSpecTransformer<
  T extends IBoxPlotSeriesSpec = IBoxPlotSeriesSpec,
  K extends IBoxPlotSeriesTheme = IBoxPlotSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.boxPlot);
  }
}

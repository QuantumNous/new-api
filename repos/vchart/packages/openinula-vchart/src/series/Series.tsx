import { BaseSeriesProps, createSeries } from './BaseSeries';
import type {
  IBarSeriesSpec,
  IAreaSeriesSpec,
  IBoxPlotSeriesSpec,
  ICircularProgressSeriesSpec,
  IDotSeriesSpec,
  IFunnelSeriesSpec,
  ILineSeriesSpec,
  ILinearProgressSeriesSpec,
  ILinkSeriesSpec,
  IMapSeriesSpec,
  IPieSeriesSpec,
  IRadarSeriesSpec,
  IRangeColumnSeriesSpec,
  IRoseSeriesSpec,
  IScatterSeriesSpec,
  IWordCloudSeriesSpec
} from '@visactor/vchart';
export type SeriesProps = (
  | IBarSeriesSpec
  | IAreaSeriesSpec
  | IBoxPlotSeriesSpec
  | ICircularProgressSeriesSpec
  | IDotSeriesSpec
  | IFunnelSeriesSpec
  | ILineSeriesSpec
  | ILinearProgressSeriesSpec
  | ILinkSeriesSpec
  | IMapSeriesSpec
  | IPieSeriesSpec
  | IRadarSeriesSpec
  | IRangeColumnSeriesSpec
  | IRoseSeriesSpec
  | IScatterSeriesSpec
  | IWordCloudSeriesSpec
) &
  BaseSeriesProps;

export const Series = createSeries<SeriesProps>('Series', ['bar', 'line', 'area']);

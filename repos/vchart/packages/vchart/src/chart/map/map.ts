import { registerMapSeries } from '../../series/map/map';
import { BaseChart } from '../base/base-chart';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IMapChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { MapChartSpecTransformer } from './map-transformer';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class MapChart<T extends IMapChartSpec = IMapChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.map;
  static readonly seriesType: string = SeriesTypeEnum.map;
  static readonly transformerConstructor = MapChartSpecTransformer;
  readonly transformerConstructor = MapChartSpecTransformer;
  readonly type: string = ChartTypeEnum.map;
  readonly seriesType: string = SeriesTypeEnum.map;
}

export const registerMapChart = () => {
  registerMarkTooltipProcessor();
  registerMapSeries();
  Factory.registerChart(MapChart.type, MapChart);
};

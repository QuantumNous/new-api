import { registerRadarSeries } from '../../series/radar/radar';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import { Factory } from '../../core/factory';
import type { IRoseChartSpec } from '../rose';
import { RadarChartSpecTransformer } from './radar-transformer';
import { BaseChart } from '../base';
import { StackChartMixin } from '../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getPolarDimensionInfo } from '../../event/events/dimension/util/polar';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class RadarChart<T extends IRoseChartSpec = IRoseChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.radar;
  static readonly seriesType: string = SeriesTypeEnum.radar;
  static readonly transformerConstructor = RadarChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = RadarChartSpecTransformer;
  readonly type: string = ChartTypeEnum.radar;
  readonly seriesType: string = SeriesTypeEnum.radar;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getPolarDimensionInfo;
  }
}

mixin(RadarChart, StackChartMixin);

export const registerRadarChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerRadarSeries();
  Factory.registerChart(RadarChart.type, RadarChart);
};

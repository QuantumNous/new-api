import { registerAreaSeries } from '../../series/area/area';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IAreaChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { AreaChartSpecTransformer } from './area-transformer';
import { BaseChart } from '../base';
import { mixin } from '@visactor/vutils';
import { StackChartMixin } from '../stack';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class AreaChart<T extends IAreaChartSpec = IAreaChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.area;
  static readonly seriesType: string = SeriesTypeEnum.area;
  static readonly transformerConstructor = AreaChartSpecTransformer;
  readonly transformerConstructor = AreaChartSpecTransformer;
  readonly type: string = ChartTypeEnum.area;
  readonly seriesType: string = SeriesTypeEnum.area;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}
mixin(AreaChart, StackChartMixin);

export const registerAreaChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionHover();
  registerAreaSeries();
  registerDimensionEvents();
  Factory.registerChart(AreaChart.type, AreaChart);
};

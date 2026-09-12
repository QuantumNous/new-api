import { ChartTypeEnum } from '../../interface';
import { SeriesTypeEnum } from '../../../series/interface/type';
import type { ILinearProgressChartSpec } from './interface';
import { registerLinearProgressSeries } from '../../../series/progress/linear';
import { Factory } from '../../../core/factory';
import { LinearProgressChartSpecTransformer } from './linear-progress-transformer';
import { BaseChart } from '../../base';
import { StackChartMixin } from '../../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../../component/tooltip/processor/mark-tooltip';

export class LinearProgressChart<T extends ILinearProgressChartSpec = ILinearProgressChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.linearProgress;
  static readonly seriesType: string = SeriesTypeEnum.linearProgress;
  static readonly transformerConstructor = LinearProgressChartSpecTransformer;
  readonly transformerConstructor = LinearProgressChartSpecTransformer;
  readonly type: string = ChartTypeEnum.linearProgress;
  readonly seriesType: string = SeriesTypeEnum.linearProgress;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

mixin(LinearProgressChart, StackChartMixin);

export const registerLinearProgressChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerLinearProgressSeries();
  Factory.registerChart(LinearProgressChart.type, LinearProgressChart);
};

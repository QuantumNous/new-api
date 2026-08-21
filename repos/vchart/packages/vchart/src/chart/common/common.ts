import { BaseChart } from '../base/base-chart';
import { ChartTypeEnum } from '../interface/type';
import { Factory } from '../../core/factory';
import type { ICommonChartSpec } from './interface';
import type { AdaptiveSpec, ILayoutPoint } from '../../typings';
import { CommonChartSpecTransformer } from './common-transformer';
import { StackChartMixin } from '../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import type { IChart } from '../interface/chart';
import { getPolarDimensionInfo } from '../../event/events/dimension/util/polar';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class CommonChart<T extends ICommonChartSpec = ICommonChartSpec> extends BaseChart<AdaptiveSpec<T, 'series'>> {
  static readonly type: string = ChartTypeEnum.common;
  static readonly transformerConstructor = CommonChartSpecTransformer;
  readonly transformerConstructor = CommonChartSpecTransformer;
  readonly type: string = ChartTypeEnum.common;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = (chart: IChart | undefined, point: ILayoutPoint, isTooltip?: boolean) => {
      return [
        ...(getCartesianDimensionInfo(chart, point, isTooltip) ?? []),
        ...(getPolarDimensionInfo(chart, point) ?? [])
      ];
    };
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

mixin(CommonChart, StackChartMixin);

export const registerCommonChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  Factory.registerChart(CommonChart.type, CommonChart);
  registerDimensionHover();
};

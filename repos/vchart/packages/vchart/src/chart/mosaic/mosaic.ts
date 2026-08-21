import { ChartTypeEnum } from '../interface/type';
import { SeriesTypeEnum } from '../../series/interface/type';
import type { IMosaicChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { MosaicChartSpecTransformer } from './mosaic-transformer';
import { BaseChart } from '../base';
import { registerMosaicSeries } from '../../series/mosaic/mosaic';
import { Stack } from '../stack';
import type { IRegion } from '../../region';
import type { IStackCacheNode, IStackCacheRoot } from '../../util/data';
import { stackMosaic, stackMosaicTotal } from '../../util/data';
import { stackSplit } from '../../data/transforms/stack-split';
import { registerDataSetInstanceTransform } from '../../data/register';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { TooltipType } from '../../component/tooltip/constant';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class MosaicChart<T extends IMosaicChartSpec = IMosaicChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.mosaic;
  static readonly seriesType: string = SeriesTypeEnum.mosaic;
  static readonly transformerConstructor = MosaicChartSpecTransformer;
  readonly transformerConstructor = MosaicChartSpecTransformer;
  readonly type: string = ChartTypeEnum.mosaic;
  readonly seriesType: string = SeriesTypeEnum.mosaic;
  protected _stack: Stack;

  protected _beforeInit() {
    if (this._dataSet) {
      registerDataSetInstanceTransform(this._dataSet, 'stackSplit', stackSplit);
    }
  }

  protected _initStack() {
    this._stack = new Stack(this, {
      afterStackRegion: this.handleAfterStackRegion
    });
    this._stack.init();
  }

  handleAfterStackRegion = (region: IRegion, stackValueGroup: { [key: string]: IStackCacheRoot }) => {
    region.getSeries().forEach(s => {
      const stackData = s.getStackData();
      const stackValue = s.getStackValue();
      const stackValueField = s.getStackValueField(); // yField
      if (stackData && stackValueField) {
        stackMosaicTotal(stackValueGroup[stackValue] as IStackCacheNode, stackValueField);
        stackMosaic(s, stackValueGroup[stackValue] as IStackCacheNode);
      }
    });
  };

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerMosaicChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerMosaicSeries();
  Factory.registerChart(MosaicChart.type, MosaicChart);
};

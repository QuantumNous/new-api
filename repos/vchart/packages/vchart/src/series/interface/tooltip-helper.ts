import type {
  Datum,
  ITooltipActual,
  ShapeType,
  TooltipActiveType,
  TooltipContentCallback,
  TooltipData
} from '../../typings';
import type { ISeries } from './series';
import type { ITooltipHelper } from '../../model/interface';
import type { ITooltipSpec } from '../../component/tooltip/interface/spec';
import type { TooltipHandlerParams } from '../../component/tooltip/interface/common';

export interface ISeriesTooltipHelper extends ITooltipHelper {
  /** 对应系列 */
  series: ISeries;

  getTooltipData: (
    activeType: TooltipActiveType,
    chartTooltipSpec?: ITooltipSpec,
    allData?: TooltipData,
    datum?: Datum[],
    params?: TooltipHandlerParams
  ) => ITooltipActual | null;

  // 可以继承的原子化回调
  markTooltipKeyCallback: TooltipContentCallback<string>;
  markTooltipValueCallback: TooltipContentCallback<string>;
  shapeTypeCallback: TooltipContentCallback<ShapeType>;
  shapeColorCallback: TooltipContentCallback<string>;
  shapeStrokeCallback: TooltipContentCallback<string>;
  dimensionTooltipTitleCallback: TooltipContentCallback<string>;
  groupTooltipTitleCallback: TooltipContentCallback<string>;
  groupTooltipKeyCallback: TooltipContentCallback<string>;
}

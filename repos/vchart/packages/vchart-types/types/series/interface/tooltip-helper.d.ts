import type { Datum, ITooltipActual, ShapeType, TooltipActiveType, TooltipContentCallback, TooltipData } from '../../typings';
import type { ISeries } from './series';
import type { ITooltipHelper } from '../../model/interface';
import type { ITooltipSpec } from '../../component/tooltip/interface/spec';
import type { TooltipHandlerParams } from '../../component/tooltip/interface/common';
export interface ISeriesTooltipHelper extends ITooltipHelper {
    series: ISeries;
    getTooltipData: (activeType: TooltipActiveType, chartTooltipSpec?: ITooltipSpec, allData?: TooltipData, datum?: Datum[], params?: TooltipHandlerParams) => ITooltipActual | null;
    markTooltipKeyCallback: TooltipContentCallback<string>;
    markTooltipValueCallback: TooltipContentCallback<string>;
    shapeTypeCallback: TooltipContentCallback<ShapeType>;
    shapeColorCallback: TooltipContentCallback<string>;
    shapeStrokeCallback: TooltipContentCallback<string>;
    dimensionTooltipTitleCallback: TooltipContentCallback<string>;
    groupTooltipTitleCallback: TooltipContentCallback<string>;
    groupTooltipKeyCallback: TooltipContentCallback<string>;
}

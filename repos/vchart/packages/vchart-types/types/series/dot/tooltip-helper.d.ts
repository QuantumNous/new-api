import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { Datum, ITooltipActual, ITooltipLinePattern, MaybeArray, TooltipActiveType, TooltipData, TooltipPatternProperty } from '../../typings';
import type { ITooltipSpec } from '../../component/tooltip/interface/spec';
import type { TooltipHandlerParams } from '../../component/tooltip/interface/common';
export declare class DotSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected enableByType(activeType: TooltipActiveType): boolean;
    protected getDefaultTitlePattern(activeType: TooltipActiveType): ITooltipLinePattern;
    shapeTypeCallback: () => string;
    protected getDefaultContentList(): MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>;
    getTooltipData(activeType: TooltipActiveType, chartTooltipSpec?: ITooltipSpec, data?: TooltipData, datum?: Datum[], params?: TooltipHandlerParams): ITooltipActual | null;
}

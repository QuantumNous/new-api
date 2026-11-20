import type { ITooltipSpec } from '../../interface';
import type { TooltipActiveType } from '../../../../typings';
import type { ISeries } from '../../../../series/interface';
import type { IDimensionInfo } from '../../../../event/events/dimension/interface';
export declare const getTooltipSpecForShow: (activeType: TooltipActiveType, globalSpec: ITooltipSpec, series?: ISeries, dimensionInfo?: IDimensionInfo[]) => ITooltipSpec;

import type { IDimensionInfo } from '../../../event/events/dimension/interface';
import type { ISeries } from '../../../series/interface';
import type { ITooltipPattern, TooltipActiveType } from '../../../typings';
export declare const makeDefaultPattern: (series: ISeries, activeType: TooltipActiveType, dimensionInfo?: IDimensionInfo[]) => ITooltipPattern | null;

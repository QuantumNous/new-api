import type { ISeries } from '../../../../series/interface';
import type { IContinuousLegendDataMakeOption, IContinuousLegendFilterOption } from './interface';
export declare const continuousLegendDataMake: (data: Array<ISeries>, op: IContinuousLegendDataMakeOption) => any;
export declare const continuousLegendFilter: (data: Array<any>, op: IContinuousLegendFilterOption) => any;

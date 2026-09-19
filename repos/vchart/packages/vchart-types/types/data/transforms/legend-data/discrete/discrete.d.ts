import type { ISeries } from '../../../../series/interface';
import type { IDiscreteLegendData, IDiscreteLegendDataMakeOption, IDiscreteLegendFilterOption } from './interface';
export declare const discreteLegendDataMake: (data: Array<ISeries>, op: IDiscreteLegendDataMakeOption) => IDiscreteLegendData[];
export declare const discreteLegendFilter: (data: Array<any>, op: IDiscreteLegendFilterOption) => any;

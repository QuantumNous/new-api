import type { IAggrType } from '../component/marker/interface';
import type { IRegressType } from '../component/marker/mark-area/interface';

export const AGGR_TYPE: IAggrType[] = ['sum', 'average', 'min', 'max', 'variance', 'standardDeviation', 'median'];

export const REGRESS_TYPE: IRegressType[] = ['regression'];

import type { IChart } from '../../../../chart/interface';
import type { IDimensionInfo } from '../interface';
import type { ILayoutPoint } from '../../../../typings/layout';
export declare const getPolarDimensionInfo: (chart: IChart | undefined, pos: ILayoutPoint) => IDimensionInfo[] | null;

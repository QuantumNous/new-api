import type { IChart } from '../../../../chart/interface';
import type { IDimensionInfo } from '../interface';
import type { CartesianAxis } from '../../../../component/axis/cartesian';
import type { ICartesianSeries } from '../../../../series/interface';
import type { ILayoutPoint } from '../../../../typings/layout';
import type { IAxis } from '../../../../component/axis';
export declare const getCartesianDimensionInfo: (chart: IChart | undefined, pos: ILayoutPoint, isTooltip?: boolean) => IDimensionInfo[] | null;
export declare const getDimensionInfoByPosition: (axis: CartesianAxis, posValue: number, getDimensionField: (series: ICartesianSeries) => string | string[]) => IDimensionInfo | null;
export declare const getDimensionInfoByValue: (axis: IAxis, value: any, getDimensionField?: (series: ICartesianSeries) => string | string[]) => IDimensionInfo | null;

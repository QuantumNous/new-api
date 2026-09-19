import type { IChart } from '../../../../chart/interface';
import type { IDimensionData, IDimensionInfo } from '../interface';
import type { AxisComponent } from '../../../../component/axis/base-axis';
import type { CoordinateType, ILayoutPoint } from '../../../../typings';
export declare const isInRegionBound: (chart: IChart, axis: AxisComponent, pos: ILayoutPoint) => boolean;
export declare const isSameDimensionInfo: (a?: IDimensionInfo, b?: IDimensionInfo) => boolean;
export declare const getDimensionData: (value: any, axis: AxisComponent, coordinate: CoordinateType, getDimensionField: (series: any) => string | string[]) => IDimensionData[];
export declare const getAxis: <T extends AxisComponent<any>>(chart: IChart, filter: (cmp: T) => boolean, pos: ILayoutPoint) => T[];

import type { IAxisHelper as CartesianHelper } from '../../component/axis/cartesian/interface/common';
import type { Datum } from '../../typings';
import type { IPolarAxisHelper } from '../../component/axis';
import type { ICartesianSeries } from '../interface';
export declare function isPolarAxisSeries(type: string): boolean;
export declare function sortDataInAxisHelper(axisHelper: CartesianHelper | IPolarAxisHelper, field: string, dataList: Datum[]): void;
export declare function getGroupAnimationParams(series: ICartesianSeries): {
    dataIndex: (datum: any) => any;
    dataCount: () => any;
};

import type { Datum } from '../../../typings';
import type { CartesianAxis } from '../../../component';
export interface ITickAlignOpt {
    targetAxis: () => CartesianAxis;
    currentAxis: () => CartesianAxis;
}
export declare const tickAlign: (data: Array<Datum>, op: ITickAlignOpt) => Datum[];

import type { CartesianAxis } from '../../../component';
import type { LinearAxisMixin } from '../../../component/axis/mixin/linear-axis-mixin';
type ScaleInfo = {
    total: number;
    negative: number;
    positive: number;
    includeZero: boolean;
    extendable_min: boolean;
    extendable_max: boolean;
    domain: number[];
};
export declare function isValidAlignDomain(domain: number[]): boolean;
export declare function getScaleInfo(axis: LinearAxisMixin, domain: number[]): ScaleInfo;
export declare const zeroAlign: (targetAxis: CartesianAxis, currentAxis: CartesianAxis) => void;
export {};

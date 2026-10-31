export type DomainType = any;
export type RangeType = any;
export type QuantScaleType = 'linear';
export type DiscreteScaleType = 'ordinal' | 'band' | 'point' | 'threshold';
export type ScaleType = QuantScaleType | DiscreteScaleType;
export interface IBaseScaleSpec {
    name: string;
    type?: ScaleType;
    domain?: DomainType[];
    unknown?: any;
}
export interface IContinuousScaleSpec extends IBaseScaleSpec {
    range?: RangeType[];
    clamp?: boolean;
    padding?: number;
}
export interface IBaseBandScaleSpec extends IBaseScaleSpec {
    range?: RangeType[];
    padding?: number;
    paddingOuter?: number;
    align?: number;
    round?: boolean;
}
export type INumericScaleSpec = IContinuousScaleSpec;
export interface ILinearScaleSpec extends INumericScaleSpec {
    type: 'linear';
}
export interface IPointScaleSpec extends IBaseBandScaleSpec {
    type: 'point';
}
export interface IOrdinalScaleSpec extends IBaseScaleSpec {
    type: 'ordinal';
}

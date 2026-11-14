export type DomainType = any;
export type RangeType = any;

export type QuantScaleType = 'linear';
// | 'pow'
// | 'sqrt'
// | 'log'
// | 'time'
// | 'utc'
// | 'sequential';
export type DiscreteScaleType = 'ordinal' | 'band' | 'point' | 'threshold';
// export type DiscretizingScaleType =
//   | 'quantile'
//   | 'quantize'
//   | 'threshold'
//   | 'bin-ordinal';
export type ScaleType = QuantScaleType | DiscreteScaleType;
// | DiscretizingScaleType
// | 'identity';

export interface IBaseScaleSpec {
  name: string;
  type?: ScaleType;
  domain?: DomainType[];
  unknown?: any;
}

export interface IContinuousScaleSpec extends IBaseScaleSpec {
  range?: RangeType[];
  // bins?: number[] | { step: number; start?: number; stop?: number };
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

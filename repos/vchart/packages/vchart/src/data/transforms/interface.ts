import type { IAggrType, IDataPointSpec, IMarkerSupportSeries } from '../../component/marker/interface';
import type { Datum, StringOrNumber } from '../../typings/common';
import type { CoordinateType } from '../../typings/coordinate';

export type StatisticOperations = Array<'max' | 'min' | 'values' | 'array-max' | 'array-min' | 'allValid'>;

export interface IStatisticsOption {
  fields: {
    key: string;
    operations: StatisticOperations;
    filter?: (fv: any) => boolean;
    customize?: { max: number; min: number } | any[];
  }[];
  // operations: Array<'max' | 'min' | 'values'>;
  target?: 'parser' | 'latest';
}

export type IOption = {
  field: string;
};

export type IOptionAggrField = {
  field: string;
  aggrType: IAggrType;
};

export type IOptionPos = IOptionAggrField | string | number | StringOrNumber[];

export type IOptionSeries = {
  getRelativeSeries: () => IMarkerSupportSeries;
  getStartRelativeSeries: () => IMarkerSupportSeries;
  getEndRelativeSeries: () => IMarkerSupportSeries;
};

export type IOptionCallback = (
  relativeSeriesData: any,
  startRelativeSeriesData: any,
  endRelativeSeriesData: any,
  relativeSeries: IMarkerSupportSeries,
  startRelative: IMarkerSupportSeries,
  endRelative: IMarkerSupportSeries
) => IOptionPos;

export type IOptionAggr = {
  x?: IOptionPos | IOptionCallback;
  y?: IOptionPos | IOptionCallback;
  angle?: IOptionPos | IOptionCallback;
  radius?: IOptionPos | IOptionCallback;
  areaName?: string | IOptionCallback;
  getRefRelativeSeries?: () => IMarkerSupportSeries;
} & IOptionSeries;

export type IOptionWithCoordinates = {
  coordinates:
    | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[] | IDataPointSpec)
    | IDataPointSpec
    | IDataPointSpec[];
  getSeriesByIdOrIndex: (seriesUserId: StringOrNumber, seriesIndex: number) => IMarkerSupportSeries;
  coordinateType: CoordinateType;
} & IOptionSeries;

export type IOptionRegr = {
  fieldX: string;
  fieldY: string;
};

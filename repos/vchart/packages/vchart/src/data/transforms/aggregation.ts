import type { DataView } from '@visactor/vdataset';
import type { IAggrType, IDataPointSpec, IDataPos, IMarkerSupportSeries } from '../../component/marker/interface';
import type { Datum, StringOrNumber } from '../../typings';
import { array, isArray, isFunction, isPlainObject, isString, isValid } from '@visactor/vutils';
import { variance, average, min, max, sum, standardDeviation, median } from '../../util/math';
import { isAggrSpec } from '../../component/marker/utils';
import type {
  IOption,
  IOptionAggr,
  IOptionAggrField,
  IOptionCallback,
  IOptionPos,
  IOptionWithCoordinates
} from './interface';

export const markerMin = (_data: Array<DataView>, opt: IOption) => {
  const data = _data[0].latestData as Datum[];

  return min(data, opt.field);
};
export const markerMax = (_data: Array<DataView>, opt: IOption) => {
  const data = _data[0].latestData as Datum[];

  return max(data, opt.field);
};

export function markerSum(_data: Array<DataView>, opt: IOption) {
  const data = _data[0].latestData;

  return sum(data, opt.field);
}
export function markerAverage(_data: Array<DataView>, opt: IOption) {
  const data = _data[0].latestData;

  return average(data, opt.field);
}

export function markerVariance(_data: Array<DataView>, opt: IOption) {
  const data = _data[0].latestData;

  return variance(data, opt.field);
}

export function markerStandardDeviation(_data: Array<DataView>, opt: IOption) {
  const data = _data[0].latestData;

  return standardDeviation(data, opt.field);
}

export function markerMedian(_data: Array<DataView>, opt: IOption) {
  const data = _data[0].latestData;

  return median(data, opt.field);
}

export function markerAggregation(_data: Array<DataView>, options: IOptionWithCoordinates | IOptionAggr[]) {
  let markerSource: IOptionAggr[];
  if ((options as IOptionWithCoordinates).coordinates) {
    const {
      coordinates: coordinatesInOptions,
      coordinateType,
      getSeriesByIdOrIndex,
      ...rest
    } = options as IOptionWithCoordinates;
    let coordinates;
    if (isFunction(coordinatesInOptions)) {
      const relativeSeries = (options as IOptionWithCoordinates).getRelativeSeries();
      coordinates = coordinatesInOptions(relativeSeries.getData().getLatestData(), relativeSeries);
    } else {
      coordinates = coordinatesInOptions;
    }
    coordinates = array(coordinates);
    let option: IOptionAggr;

    markerSource = coordinates.map((coordinate: IDataPointSpec) => {
      const refRelativeSeries = getSeriesByIdOrIndex(coordinate.refRelativeSeriesId, coordinate.refRelativeSeriesIndex);

      if (coordinateType === 'cartesian') {
        const { xField, yField } = refRelativeSeries.getSpec();
        const { xFieldDim, xFieldIndex, yFieldDim, yFieldIndex } = coordinate;
        let bindXField = xField;
        if (isValid(xFieldIndex)) {
          bindXField = array(xField)[xFieldIndex];
        }
        if (xFieldDim && array(xField).includes(xFieldDim)) {
          bindXField = xFieldDim;
        }

        let bindYField = yField;
        if (isValid(yFieldIndex)) {
          bindYField = array(yField)[yFieldIndex];
        }
        if (yFieldDim && array(yField).includes(yFieldDim)) {
          bindYField = yFieldDim;
        }

        option = {
          x: undefined,
          y: undefined,
          ...rest
        };

        if (isString(coordinate[bindXField]) && isAggrSpec(coordinate[bindXField] as IDataPos)) {
          option.x = { field: bindXField, aggrType: coordinate[bindXField] as IAggrType };
        } else {
          option.x = array(bindXField).map(field => coordinate[field]) as StringOrNumber[];
        }

        if (isString(coordinate[bindYField]) && isAggrSpec(coordinate[bindYField] as IDataPos)) {
          option.y = { field: bindYField, aggrType: coordinate[bindYField] as IAggrType };
        } else {
          option.y = array(bindYField).map(field => coordinate[field]) as StringOrNumber[];
        }
      } else if (coordinateType === 'polar') {
        const { valueField: radiusField, categoryField: angleField } = refRelativeSeries.getSpec();
        const { angleFieldDim, angleFieldIndex } = coordinate;
        let bindAngleField = angleField;
        if (isValid(angleFieldIndex)) {
          bindAngleField = array(angleField)[angleFieldIndex];
        }
        if (angleFieldDim && array(angleField).includes(angleFieldDim)) {
          bindAngleField = angleFieldDim;
        }

        const bindRadiusField = radiusField;

        option = {
          angle: undefined,
          radius: undefined,
          ...rest
        };

        if (isString(coordinate[bindAngleField]) && isAggrSpec(coordinate[bindAngleField] as IDataPos)) {
          option.angle = { field: bindAngleField, aggrType: coordinate[bindAngleField] as IAggrType };
        } else {
          option.angle = array(bindAngleField).map(field => coordinate[field]) as StringOrNumber[];
        }

        if (isString(coordinate[bindRadiusField]) && isAggrSpec(coordinate[bindRadiusField] as IDataPos)) {
          option.radius = { field: bindRadiusField, aggrType: coordinate[bindRadiusField] as IAggrType };
        } else {
          option.radius = array(bindRadiusField).map(field => coordinate[field]) as StringOrNumber[];
        }
      }

      option.getRefRelativeSeries = () => refRelativeSeries;
      return option;
    });
  } else {
    markerSource = options as IOptionAggr[];
  }

  const results: {
    x: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    y: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    angle: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    radius: StringOrNumber[] | StringOrNumber | IOptionCallback | null;
    areaName: string | IOptionCallback | null;
  }[] = [];
  markerSource.forEach(option => {
    const result: {
      x: StringOrNumber[] | StringOrNumber | null;
      y: StringOrNumber[] | StringOrNumber | null;
      angle: StringOrNumber[] | StringOrNumber | null;
      radius: StringOrNumber[] | StringOrNumber | null;
      areaName: string | null;
      getRefRelativeSeries?: () => IMarkerSupportSeries;
    } = { x: null, y: null, angle: null, radius: null, areaName: null };

    if (isValid(option.x)) {
      const x = option.x;

      if (isArray(x)) {
        result.x = x.map(item => getFinalValue(item, _data, option)) as StringOrNumber[];
      } else {
        result.x = getFinalValue(x, _data, option) as StringOrNumber;
      }
    }
    if (isValid(option.y)) {
      const y = option.y;
      if (isArray(y)) {
        result.y = y.map(item => getFinalValue(item, _data, option)) as StringOrNumber[];
      } else {
        result.y = getFinalValue(y, _data, option) as StringOrNumber;
      }
    }
    if (isValid(option.angle)) {
      const angle = option.angle;
      if (isArray(angle)) {
        result.angle = angle.map(item => getFinalValue(item, _data, option)) as StringOrNumber[];
      } else {
        result.angle = getFinalValue(angle, _data, option) as StringOrNumber;
      }
    }
    if (isValid(option.radius)) {
      const radius = option.radius;
      if (isArray(radius)) {
        result.radius = radius.map(item => getFinalValue(item, _data, option)) as StringOrNumber[];
      } else {
        result.radius = getFinalValue(radius, _data, option) as StringOrNumber;
      }
    }
    if (isValid(option.areaName)) {
      const name = option.areaName;
      result.areaName = getFinalValue(name, _data, option) as string;
    }
    if (option.getRefRelativeSeries) {
      result.getRefRelativeSeries = option.getRefRelativeSeries;
    }
    results.push(result);
  });

  return results;
}

const aggrMap = {
  min: markerMin,
  max: markerMax,
  sum: markerSum,
  average: markerAverage,
  variance: markerVariance,
  standardDeviation: markerStandardDeviation,
  median: markerMedian
};

function getFinalValue(source: IOptionPos | IOptionCallback, _data: Array<DataView>, option: IOptionAggr) {
  const relativeSeries = option.getRelativeSeries();
  const startSeries = option.getStartRelativeSeries();
  const endSeries = option.getEndRelativeSeries();
  const relativeSeriesData = relativeSeries.getData().getLatestData();
  const startRelativeSeriesData = startSeries.getData().getLatestData();
  const endRelativeSeriesData = endSeries.getData().getLatestData();

  if (isFunction(source)) {
    return source(
      relativeSeriesData,
      startRelativeSeriesData,
      endRelativeSeriesData,
      relativeSeries,
      startSeries,
      endSeries
    ) as StringOrNumber[] | StringOrNumber;
  }
  if (isPlainObject(source)) {
    const { aggrType, field } = source as IOptionAggrField;
    return aggrMap[aggrType](_data, { field: field });
  }

  return source;
}

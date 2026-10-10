import type { ICartesianSeries, IGeoSeries, IPolarSeries, ISeries } from '../../series/interface';
import type { DataView } from '@visactor/vdataset';
import {
  isValid,
  isNumber,
  array,
  minInArray,
  maxInArray,
  isArray,
  normalizePadding,
  isFunction,
  type IPointLike
} from '@visactor/vutils';
import type { Datum, IPoint, StringOrNumber } from '../../typings';
import { isPercent, transformToGraphic } from '../../util';
import type {
  IDataPos,
  IMarkerAttributeContext,
  IMarkerLabelSpec,
  IMarkerState,
  IMarkerSupportSeries,
  IPolarPoint,
  MarkerPositionPoint,
  MarkerStateValue
} from './interface';
import { AGGR_TYPE } from '../../constant/marker';
import type { IRegion } from '../../region/interface';
// eslint-disable-next-line no-duplicate-imports
import type { OffsetPoint } from './interface';
import type { IAxisHelper, IPolarAxisHelper } from '../axis';
import type { BandScale } from '@visactor/vscale';
import { isContinuous } from '@visactor/vscale';

type FullBandTemp = {
  min: {
    value: number;
    index: number;
  };
  max: {
    value: number;
    index: number;
  };
};

type CartesianCoordinateDatum = {
  x: StringOrNumber[] | StringOrNumber | null;
  y: StringOrNumber[] | StringOrNumber | null;
  getRefRelativeSeries?: () => ICartesianSeries;
};

function isNeedExtendDomain(domain: number[], datum: number, autoRange: boolean) {
  if (!autoRange) {
    return false;
  }
  const domainNum = domain.map((n: any) => n * 1);
  const min = minInArray(domainNum);
  const max = maxInArray(domainNum);
  if (datum < min || datum > max) {
    return true;
  }
  return false;
}

function getAutoRangeExtendDomainKey(
  keyPrefix: string | undefined,
  axisKey: 'xAxis' | 'yAxis' | 'angleAxis' | 'radiusAxis'
) {
  return keyPrefix ? `${keyPrefix}_${axisKey}_extend` : `marker_${axisKey}_extend`;
}

function getXValue(
  datum: Datum,
  xDomain: number[],
  autoRange: boolean,
  refSeries: { [key: string]: IMarkerSupportSeries },
  regionWidth: number,
  regionStartLayoutStartPoint: IPoint,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const { relativeSeries } = refSeries;
  isNumber(datum.x) &&
    isNeedExtendDomain(xDomain, datum.x, autoRange) &&
    (relativeSeries as ICartesianSeries)
      ?.getXAxisHelper()
      .setExtendDomain?.(getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'xAxis'), datum.x);
  let x: number;
  if (isPercent(datum.x)) {
    x = convertPercentToValue(datum.x, regionWidth) + regionStartLayoutStartPoint.x;
  } else {
    x =
      convertDatumToValue((relativeSeries as ICartesianSeries).getXAxisHelper(), [datum.x]) +
      regionStartLayoutStartPoint.x;
  }

  return x;
}

function getYValue(
  datum: Datum,
  yDomain: number[],
  autoRange: boolean,
  refSeries: { [key: string]: IMarkerSupportSeries },
  regionHeight: number,
  regionStartLayoutStartPoint: IPoint,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const { relativeSeries } = refSeries;
  isNumber(datum.y) &&
    isNeedExtendDomain(yDomain, datum.y, autoRange) &&
    (relativeSeries as ICartesianSeries)
      .getYAxisHelper()
      ?.setExtendDomain?.(getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'yAxis'), datum.y);

  let y: number;
  if (isPercent(datum.y)) {
    y = convertPercentToValue(datum.y, regionHeight) + regionStartLayoutStartPoint.y;
  } else {
    y =
      convertDatumToValue((relativeSeries as ICartesianSeries).getYAxisHelper(), [datum.y]) +
      regionStartLayoutStartPoint.y;
  }

  return y;
}

function getAngleValue(
  datum: Datum,
  angleDomain: number[],
  autoRange: boolean,
  refSeries: { [key: string]: IMarkerSupportSeries },
  autoRangeExtendDomainKeyPrefix?: string
) {
  const { relativeSeries } = refSeries;
  isNumber(datum.angle) &&
    isNeedExtendDomain(angleDomain, datum.angle, autoRange) &&
    (relativeSeries as IPolarSeries).angleAxisHelper?.setExtendDomain?.(
      getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'angleAxis'),
      datum.angle
    );

  return convertDatumToValue((relativeSeries as IPolarSeries).angleAxisHelper, [datum.angle]);
}

function getRadiusValue(
  datum: Datum,
  radiusDomain: number[],
  autoRange: boolean,
  refSeries: { [key: string]: IMarkerSupportSeries },
  autoRangeExtendDomainKeyPrefix?: string
) {
  const { relativeSeries } = refSeries;
  isNumber(datum.radius) &&
    isNeedExtendDomain(radiusDomain, datum.radius, autoRange) &&
    (relativeSeries as IPolarSeries).radiusAxisHelper?.setExtendDomain?.(
      getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'radiusAxis'),
      datum.radius
    );

  return convertDatumToValue((relativeSeries as IPolarSeries).radiusAxisHelper, [datum.radius]);
}

function convertPercentToValue(percent: string, relativeLength: number) {
  return (Number(percent.substring(0, percent.length - 1)) * relativeLength) / 100;
}

function convertDatumToValue(axisHelper: IAxisHelper | IPolarAxisHelper, datum: (number | string)[]) {
  const scale = axisHelper.getScale(0);
  if (isContinuous(scale.type) && scale.domain()[0] === scale.domain()[1] && datum[0] !== scale.domain()[0]) {
    return NaN;
  }
  return axisHelper.dataToPosition(datum);
}

export function isAggrSpec(spec: IDataPos) {
  return AGGR_TYPE.includes(spec as any);
}

export function xyLayout(
  data: DataView,
  startRelativeSeries: IMarkerSupportSeries,
  endRelativeSeries: IMarkerSupportSeries,
  relativeSeries: IMarkerSupportSeries,
  autoRange: boolean,
  includeFullBand: boolean = false,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const regionStart = startRelativeSeries.getRegion();
  const regionStartLayoutStartPoint = regionStart.getLayoutStartPoint();
  const regionEnd = endRelativeSeries.getRegion();
  const regionEndLayoutStartPoint = regionEnd.getLayoutStartPoint();

  const regionWidth = Math.abs(
    Math.min(regionStartLayoutStartPoint.x, regionEndLayoutStartPoint.x) -
      Math.max(
        regionStartLayoutStartPoint.x + regionStart.getLayoutRect().width,
        regionEndLayoutStartPoint.x + regionEnd.getLayoutRect().width
      )
  );
  const regionHeight = Math.abs(
    Math.min(regionStartLayoutStartPoint.y, regionEndLayoutStartPoint.y) -
      Math.max(
        regionStartLayoutStartPoint.y + regionStart.getLayoutRect().height,
        regionEndLayoutStartPoint.y + regionEnd.getLayoutRect().height
      )
  );

  const refSeries = {
    relativeSeries,
    startRelativeSeries,
    endRelativeSeries
  };

  const lines: IPoint[][] = [];
  const dataPoints =
    data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;

  const xAxisHelper = (relativeSeries as ICartesianSeries).getXAxisHelper();
  const yAxisHelper = (relativeSeries as ICartesianSeries).getYAxisHelper();

  const xDomain = xAxisHelper.getScale(0).domain();
  const yDomain = yAxisHelper.getScale(0).domain();

  const isXExpand = includeFullBand && !xAxisHelper.isContinuous && !!xAxisHelper.getBandwidth;
  const isyExpand = includeFullBand && !yAxisHelper.isContinuous && !!yAxisHelper.getBandwidth;
  const xTemp: FullBandTemp = { min: null, max: null };
  const yTemp: FullBandTemp = { min: null, max: null };

  dataPoints.forEach((datum: IPoint) => {
    const isValidX = isValid(datum.x);
    const isValidY = isValid(datum.y);
    let x;
    let y;
    if (isValidX && isValidY) {
      x = getXValue(
        datum,
        xDomain,
        autoRange,
        refSeries,
        regionWidth,
        regionStartLayoutStartPoint,
        autoRangeExtendDomainKeyPrefix
      );
      y = getYValue(
        datum,
        yDomain,
        autoRange,
        refSeries,
        regionHeight,
        regionStartLayoutStartPoint,
        autoRangeExtendDomainKeyPrefix
      );
      setTempWithValid(x, isXExpand, xTemp, lines.length);
      setTempWithValid(y, isyExpand, yTemp, lines.length);
      lines.push([{ x, y }]);
    } else if (isValidX) {
      x = getXValue(
        datum,
        xDomain,
        autoRange,
        refSeries,
        regionWidth,
        regionStartLayoutStartPoint,
        autoRangeExtendDomainKeyPrefix
      );
      y = Math.max(
        regionStartLayoutStartPoint.y + regionStart.getLayoutRect().height,
        regionEndLayoutStartPoint.y + regionEnd.getLayoutRect().height
      );
      const y1 = Math.min(regionStartLayoutStartPoint.y, regionEndLayoutStartPoint.y);
      setTempWithValid(x, isXExpand, xTemp, lines.length);
      lines.push([
        {
          x: x,
          y: y
        },
        {
          x: x,
          y: y1
        }
      ]);
    } else if (isValidY) {
      x = Math.min(regionStartLayoutStartPoint.x, regionEndLayoutStartPoint.x);
      y = getYValue(
        datum,
        yDomain,
        autoRange,
        refSeries,
        regionHeight,
        regionStartLayoutStartPoint,
        autoRangeExtendDomainKeyPrefix
      );
      const x1 = Math.max(
        regionStartLayoutStartPoint.x + regionStart.getLayoutRect().width,
        regionEndLayoutStartPoint.x + regionEnd.getLayoutRect().width
      );
      setTempWithValid(y, isyExpand, yTemp, lines.length);
      lines.push([
        {
          x: x,
          y: y
        },
        {
          x: x1,
          y: y
        }
      ]);
    }
  });
  setTempToLines(lines, xAxisHelper, yAxisHelper, xTemp, yTemp);
  return lines;
}

function setTempToLines(
  lines: IPoint[][],
  xAxisHelper: IAxisHelper | IPolarAxisHelper,
  yAxisHelper: IAxisHelper | IPolarAxisHelper,
  xTemp: FullBandTemp,
  yTemp: FullBandTemp
) {
  if (xTemp.min || xTemp.max) {
    const xBandSize = xAxisHelper.getBandwidth(0) * (1 + (xAxisHelper.getScale(0) as BandScale).paddingInner());
    if (xTemp.min) {
      lines[xTemp.min.index].forEach(p => (p.x -= xBandSize / 2));
    }
    if (xTemp.max) {
      lines[xTemp.max.index].forEach(p => (p.x += xBandSize / 2));
    }
  }
  if (yTemp.min || yTemp.max) {
    const yBandSize = yAxisHelper.getBandwidth(0) * (1 + (yAxisHelper.getScale(0) as BandScale).paddingInner());
    if (yTemp.min) {
      lines[yTemp.min.index].forEach(p => (p.y -= yBandSize / 2));
    }
    if (yTemp.max) {
      lines[yTemp.max.index].forEach(p => (p.y += yBandSize / 2));
    }
  }
}

function setTempWithValid(v: number, isExpand: boolean, temp: FullBandTemp, index: number): number {
  if (isExpand) {
    if (temp.min === null || temp.min.value > v) {
      temp.min = {
        value: v,
        index
      };
    }
    if (temp.max === null || temp.max.value < v) {
      temp.max = {
        value: v,
        index
      };
    }
  }
  return v;
}

export function polarLayout(
  data: DataView,
  startRelativeSeries: IMarkerSupportSeries,
  endRelativeSeries: IMarkerSupportSeries,
  relativeSeries: IMarkerSupportSeries,
  autoRange: boolean,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const refSeries = {
    relativeSeries,
    startRelativeSeries,
    endRelativeSeries
  };
  const lines: IPolarPoint[][] = [];
  const dataPoints =
    data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;

  const angleDomain = (relativeSeries as IPolarSeries).angleAxisHelper.getScale(0).domain();
  const radiusDomain = (relativeSeries as IPolarSeries).radiusAxisHelper.getScale(0).domain();
  const regionRadius = Math.min(
    relativeSeries.getRegion().getLayoutRect().width / 2,
    relativeSeries.getRegion().getLayoutRect().height / 2
  );
  dataPoints.forEach((datum: IPolarPoint) => {
    const isValidAngle = isValid(datum.angle);
    const isValidRadius = isValid(datum.radius);
    if (isValidAngle && isValidRadius) {
      const angle = getAngleValue(datum, angleDomain, autoRange, refSeries, autoRangeExtendDomainKeyPrefix);
      const radius = getRadiusValue(datum, radiusDomain, autoRange, refSeries, autoRangeExtendDomainKeyPrefix);
      lines.push([{ angle, radius }]);
    } else if (isValidAngle) {
      const angle = getAngleValue(datum, angleDomain, autoRange, refSeries, autoRangeExtendDomainKeyPrefix);
      lines.push([
        {
          angle,
          radius: -regionRadius
        },
        {
          angle,
          radius: regionRadius
        }
      ]);
    } else if (isValidRadius) {
      const radius = getRadiusValue(datum, radiusDomain, autoRange, refSeries, autoRangeExtendDomainKeyPrefix);
      lines.push([
        {
          radius,
          angle: 0
        },
        {
          radius,
          angle: Math.PI * 2
        }
      ]);
    }
  });

  return lines;
}

export function geoLayout(data: DataView, relativeSeries: IMarkerSupportSeries) {
  const lines: IPoint[][] = [];
  const dataPoints =
    data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;
  dataPoints.forEach((datum: any) => {
    const isValidName = isValid(datum.areaName);
    if (isValidName) {
      lines.push([
        {
          x:
            (relativeSeries as IGeoSeries).nameValueToPosition(datum.areaName).x +
            relativeSeries.getRegion().getLayoutStartPoint().x,
          y:
            (relativeSeries as IGeoSeries).nameValueToPosition(datum.areaName).y +
            relativeSeries.getRegion().getLayoutStartPoint().y
        }
      ]);
    }
  });

  return lines;
}

function getCartesianCoordinateRefSeries(datum: CartesianCoordinateDatum, relativeSeries: IMarkerSupportSeries) {
  return (datum?.getRefRelativeSeries ? datum.getRefRelativeSeries() : relativeSeries) as ICartesianSeries;
}

function extendCartesianCoordinateDomain(
  datum: CartesianCoordinateDatum,
  refRelativeSeries: ICartesianSeries,
  autoRange: boolean,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const xDomain = refRelativeSeries.getXAxisHelper().getScale(0).domain();
  const yDomain = refRelativeSeries.getYAxisHelper().getScale(0).domain();
  const xValue = array(datum.x);
  const yValue = array(datum.y);

  xValue.length === 1 &&
    isNumber(xValue[0]) &&
    isNeedExtendDomain(xDomain, xValue[0], autoRange) &&
    refRelativeSeries
      .getXAxisHelper()
      ?.setExtendDomain?.(getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'xAxis'), xValue[0] as number);

  yValue.length === 1 &&
    isNumber(yValue[0]) &&
    isNeedExtendDomain(yDomain, yValue[0], autoRange) &&
    refRelativeSeries
      .getYAxisHelper()
      ?.setExtendDomain?.(getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'yAxis'), yValue[0] as number);
}

export function cartesianCoordinateLayout(
  data: DataView,
  relativeSeries: IMarkerSupportSeries,
  autoRange: boolean,
  coordinatesOffset: OffsetPoint[] | OffsetPoint,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const points: IPoint[] = [];
  const dataPoints =
    data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;
  const isArrayCoordinatesOffset = isArray(coordinatesOffset);

  if (autoRange) {
    dataPoints.forEach((datum: CartesianCoordinateDatum) => {
      extendCartesianCoordinateDomain(
        datum,
        getCartesianCoordinateRefSeries(datum, relativeSeries),
        autoRange,
        autoRangeExtendDomainKeyPrefix
      );
    });
  }

  dataPoints.forEach((datum: CartesianCoordinateDatum, index: number) => {
    const refRelativeSeries = getCartesianCoordinateRefSeries(datum, relativeSeries);
    const regionStart = refRelativeSeries.getRegion();
    const regionStartLayoutStartPoint = regionStart.getLayoutStartPoint();

    const { width: regionWidth, height: regionHeight } = regionStart.getLayoutRect();

    let offsetX = 0;
    let offsetY = 0;
    if (coordinatesOffset) {
      const currentCoordinatesOffset = isArrayCoordinatesOffset ? coordinatesOffset[index] : coordinatesOffset;
      const x = currentCoordinatesOffset.x;
      const y = currentCoordinatesOffset.y;
      if (x) {
        offsetX = isPercent(x) ? (Number(x.substring(0, x.length - 1)) * regionWidth) / 100 : (x as number);
      }
      if (y) {
        offsetY = isPercent(y) ? (Number(y.substring(0, y.length - 1)) * regionHeight) / 100 : (y as number);
      }
    }

    const xValue = array(datum.x);
    const yValue = array(datum.y);

    points.push({
      x: convertDatumToValue(refRelativeSeries.getXAxisHelper(), xValue) + regionStartLayoutStartPoint.x + offsetX,
      y: convertDatumToValue(refRelativeSeries.getYAxisHelper(), yValue) + regionStartLayoutStartPoint.y + offsetY
    });
  });
  return points;
}

export function polarCoordinateLayout(
  data: DataView,
  relativeSeries: IMarkerSupportSeries,
  autoRange: boolean,
  autoRangeExtendDomainKeyPrefix?: string
) {
  const points: IPolarPoint[] = [];
  const dataPoints =
    data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;
  dataPoints.forEach(
    (datum: {
      angle: StringOrNumber[] | StringOrNumber | null;
      radius: StringOrNumber[] | StringOrNumber | null;
      getRefRelativeSeries?: () => ICartesianSeries;
    }) => {
      const refRelativeSeries = (
        datum?.getRefRelativeSeries ? datum.getRefRelativeSeries() : relativeSeries
      ) as IPolarSeries;

      const angleDomain = refRelativeSeries.angleAxisHelper.getScale(0).domain();
      const radiusDomain = refRelativeSeries.radiusAxisHelper.getScale(0).domain();
      const angleValue = array(datum.angle);
      const radiusValue = array(datum.radius);

      angleValue.length === 1 &&
        isNumber(angleValue[0]) &&
        isNeedExtendDomain(angleDomain, angleValue[0], autoRange) &&
        refRelativeSeries.angleAxisHelper?.setExtendDomain?.(
          getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'angleAxis'),
          angleValue[0] as number
        );

      radiusValue.length === 1 &&
        isNumber(radiusValue[0]) &&
        isNeedExtendDomain(radiusDomain, radiusValue[0], autoRange) &&
        refRelativeSeries.radiusAxisHelper?.setExtendDomain?.(
          getAutoRangeExtendDomainKey(autoRangeExtendDomainKeyPrefix, 'radiusAxis'),
          radiusValue[0] as number
        );
      points.push({
        angle: convertDatumToValue(refRelativeSeries.angleAxisHelper, angleValue),
        radius: convertDatumToValue(refRelativeSeries.radiusAxisHelper, radiusValue)
      });
    }
  );
  return points;
}

function convertPosition(position: MarkerPositionPoint, relativeWidth: number, relativeHeight: number): IPoint {
  let { x, y } = position;
  if (isPercent(x)) {
    x = convertPercentToValue(x, relativeWidth);
  }
  if (isPercent(y)) {
    y = convertPercentToValue(y, relativeHeight);
  }

  return {
    x: x as number,
    y: y as number
  };
}

export function positionLayout(
  positions:
    | MarkerPositionPoint
    | MarkerPositionPoint[]
    | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint)
    | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint[]),
  series: IMarkerSupportSeries,
  regionRelative: boolean
): IPoint[] {
  let transformPositions;
  if (isFunction(positions)) {
    transformPositions = array(positions(series.getData().getLatestData(), series));
  } else {
    transformPositions = array(positions);
  }

  if (regionRelative) {
    const region = series.getRegion();
    const { x: regionStartX, y: regionStartY } = region.getLayoutStartPoint();
    const { width: regionWidth, height: regionHeight } = region.getLayoutRect();
    return transformPositions.map(position => {
      let { x, y } = convertPosition(position, regionWidth, regionHeight);

      x = (x as number) + regionStartX;
      y = (y as number) + regionStartY;

      return {
        x,
        y
      };
    });
  }

  const { width: canvasWidth, height: canvasHeight } = series.getOption().getChart().getViewRect();
  return transformPositions.map(position => {
    return convertPosition(position, canvasWidth, canvasHeight);
  });
}

export function computeClipRange(regions: IRegion[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  regions.forEach((region: IRegion) => {
    const regionPos = region.getLayoutStartPoint();
    const regionRect = region.getLayoutRect();
    if (regionPos.x < minX) {
      minX = regionPos.x;
    }
    if (regionPos.x + regionRect.width > maxX) {
      maxX = regionPos.x + regionRect.width;
    }
    if (regionPos.y < minY) {
      minY = regionPos.y;
    }
    if (regionPos.y + regionRect.height > maxY) {
      maxY = regionPos.y + regionRect.height;
    }
  });
  return { minX, maxX, minY, maxY };
}

export function transformLabelAttributes(
  label: IMarkerLabelSpec,
  markerData: any,
  markAttributeContext: IMarkerAttributeContext
) {
  const { labelBackground = {}, style, shape, ...restLabel } = label;

  if (label.visible !== false) {
    const labelAttrs = restLabel as any;

    if (shape?.visible) {
      labelAttrs.shape = {
        visible: true,
        ...transformToGraphic(shape.style)
      };
    } else {
      labelAttrs.shape = {
        visible: false
      };
    }

    if (labelBackground.visible !== false) {
      labelAttrs.panel = {
        visible: true,
        customShape: labelBackground.customShape,
        ...transformStyle(transformToGraphic(labelBackground.style), markerData, markAttributeContext)
      };
      if (isValid(labelBackground.padding)) {
        labelAttrs.padding = normalizePadding(labelBackground.padding);
      }
    } else {
      labelAttrs.panel = {
        visible: false
      };
      labelAttrs.padding = 0;
    }

    if (style) {
      labelAttrs.textStyle = transformStyle(transformToGraphic(style), markerData, markAttributeContext);
    }
    return labelAttrs;
  }
  return {
    visible: false
  };
}

export function transformState(
  state: {} | Record<MarkerStateValue, any | IMarkerState<any>>,
  markerData: DataView,
  markerAttributeContext: IMarkerAttributeContext
) {
  for (const stateKey in state) {
    if (isFunction(state[stateKey])) {
      state[stateKey] = state[stateKey](markerData, markerAttributeContext);
    }
  }
  return state;
}

export function transformStyle(style: any, markerData: DataView, markerAttributeContext: IMarkerAttributeContext) {
  if (isFunction(style)) {
    return style(markerData, markerAttributeContext);
  }
  return style;
}

export function transformOffset(offset: string | number | Function, region: IRegion) {
  if (isFunction(offset)) {
    return offset(region);
  }
  return offset;
}

export function computeOffsetFromRegion(point: IPointLike, offset: string | number, region: IRegion): number {
  if (!isValid(point)) {
    return offset as number;
  }
  if (offset === 'regionLeft') {
    return region.getLayoutStartPoint().x - point.x;
  } else if (offset === 'regionRight') {
    return region.getLayoutStartPoint().x + region.getLayoutRect().width - point.x;
  } else if (offset === 'regionTop') {
    return region.getLayoutStartPoint().y - point.y;
  } else if (offset === 'regionBottom') {
    return region.getLayoutStartPoint().y + region.getLayoutRect().height - point.y;
  }
  return offset as number;
}

export function getProcessInfo(spec: any) {
  return {
    isXProcess: isValid(spec.x),
    isYProcess: isValid(spec.y),
    isX1Process: isValid(spec.x1),
    isY1Process: isValid(spec.y1),
    isAngleProcess: isValid(spec.angle),
    isRadiusProcess: isValid(spec.radius),
    isAngle1Process: isValid(spec.angle1),
    isRadius1Process: isValid(spec.radius1),
    isCoordinatesProcess: isValid(spec.coordinates),
    isValidProcess: isValid(spec.process)
  };
}

export function getMarkLineProcessInfo(spec: any) {
  const {
    isXProcess,
    isYProcess,
    isX1Process,
    isY1Process,
    isAngleProcess,
    isRadiusProcess,
    isAngle1Process,
    isRadius1Process,
    isCoordinatesProcess,
    isValidProcess
  } = getProcessInfo(spec);

  return {
    doXProcess: isXProcess && !isYProcess && !isY1Process,
    doXYY1Process: isXProcess && isYProcess && isY1Process,
    doYProcess: isYProcess && !isXProcess && !isX1Process,
    doYXX1Process: isYProcess && isXProcess && isX1Process,
    doXYProcess: isXProcess && isYProcess && isX1Process && isY1Process,
    doAngleProcess: isAngleProcess && !isAngle1Process && !isRadiusProcess && !isRadius1Process,
    doRadiusProcess: isRadiusProcess && !isRadius1Process && !isAngleProcess && !isAngle1Process,
    doAngRadRad1Process: isAngleProcess && !isAngle1Process && isRadiusProcess && isRadius1Process,
    doRadAngAng1Process: isRadiusProcess && isAngleProcess && isAngle1Process && !isRadius1Process,
    doRadAngProcess: isAngleProcess && isRadiusProcess && isAngle1Process && isRadius1Process,
    doCoordinatesProcess: isCoordinatesProcess && (!isValidProcess || ('process' in spec && 'xy' in spec.process))
  };
}

export function getMarkAreaProcessInfo(spec: any) {
  const {
    isXProcess,
    isYProcess,
    isX1Process,
    isY1Process,
    isAngleProcess,
    isRadiusProcess,
    isAngle1Process,
    isRadius1Process,
    isCoordinatesProcess
  } = getProcessInfo(spec);
  return {
    doXProcess: isXProcess && isX1Process && !isYProcess && !isY1Process,
    doYProcess: isYProcess && isY1Process && !isXProcess && !isX1Process,
    doXYProcess: isXProcess && isX1Process && isYProcess && isY1Process,
    doAngleProcess: isAngleProcess && isAngle1Process && !isRadiusProcess && !isRadius1Process,
    doRadiusProcess: isRadiusProcess && isRadius1Process && !isAngleProcess && !isAngle1Process,
    doRadAngProcess: isAngleProcess && isRadiusProcess && isAngle1Process && isRadius1Process,
    doCoordinatesProcess: isCoordinatesProcess
  };
}

export function getMarkPointProcessInfo(spec: any) {
  const isXYProcess = isValid(spec.x) && isValid(spec.y);
  const isPolarProcess = isValid(spec.angle) && isValid(spec.radius);
  const isGeoProcess = isValid(spec.areaName);
  return {
    doXYProcess: isXYProcess,
    doPolarProcess: isPolarProcess,
    doGeoProcess: isGeoProcess
  };
}

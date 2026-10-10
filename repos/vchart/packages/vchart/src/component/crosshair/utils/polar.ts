import type { BandScale } from '@visactor/vscale';
import type { IPolarSeries } from '../../../series';
import type { CrossHairStateByField, CrossHairStateItem, ICrosshairInfo } from '../interface';
import { getAxisLabelOffset } from '../../axis/util';
import { PointService, clamp, getAngleByPoint, getIntersectPoint, isValid, polarToCartesian } from '@visactor/vutils';
import type { ILinearAxis, IPolarAxis } from '../../axis';
import { getFormatFunction } from '../../util';
import type { ILayoutPoint } from '../../../typings/layout';

export const layoutByValue = (
  stateByField: CrossHairStateByField,
  series: IPolarSeries,
  enableRemain: boolean = false
) => {
  Object.keys(stateByField).forEach(field => {
    const { attributes, currentValue, cacheInfo, coordKey } = stateByField[field];

    if (attributes) {
      const isVisible = !!currentValue.size;
      const useCache = enableRemain && !isVisible && isValid(cacheInfo);
      const newInfo = useCache
        ? cacheInfo
        : ({
            coord: 0,
            axis: null,
            visible: isVisible,
            coordRange: [0, 0],
            sizeRange: [0, 0],
            labels: {
              all: { visible: false, text: '', offset: 0 }
            }
          } as ICrosshairInfo);
      if (cacheInfo) {
        cacheInfo._isCache = useCache;
      }

      if (field === 'valueField') {
        (newInfo as any).sides = (series.angleAxisHelper.getScale(0) as BandScale).domain().length;
      }

      currentValue.forEach(({ axis, datum: value = '' }) => {
        const niceLabelFormatter = (axis as ILinearAxis).niceLabelFormatter;

        if (attributes.label?.visible) {
          newInfo.labels.all.visible = true;
          newInfo.labels.all.defaultFormatter = niceLabelFormatter;
          newInfo.labels.all.text = value;
          newInfo.labels.all.offset = getAxisLabelOffset(axis.getSpec());
        }

        if (field === 'categoryField') {
          const angle = series.angleAxisHelper.dataToPosition([value]);
          const bandSize = series.angleAxisHelper.getBandwidth(0);
          const radius = (axis as IPolarAxis).getOuterRadius();

          newInfo.coord = angle;
          newInfo.coordRange = [angle - bandSize / 2, angle + bandSize / 2];
          newInfo.sizeRange = [radius, radius];
        } else {
          const angle = (axis as IPolarAxis).startAngle;
          const radius = series.radiusAxisHelper.dataToPosition([value]);

          newInfo.coord = radius;
          newInfo.coordRange = [radius, radius];
          newInfo.sizeRange = [angle, angle];
        }

        newInfo.axis = axis as IPolarAxis;
      });

      if (newInfo && !useCache) {
        if (newInfo.labels.all.visible) {
          if (attributes && attributes.label) {
            const label = newInfo.labels.all;
            const { formatMethod, formatter } = attributes.label;
            const { formatFunc, args } = getFormatFunction(formatMethod, formatter, label.text, {
              label: label.text,
              orient: coordKey
            });
            if (formatFunc) {
              label.text = formatFunc(...args);
            } else if (label.defaultFormatter) {
              label.text = label.defaultFormatter(label.text);
            }
          }
        }
      }

      stateByField[field].cacheInfo = newInfo;
    }
  });
};

export const layoutCrosshair = (stateItem: CrossHairStateItem, layoutStartPoint: ILayoutPoint, smooth?: boolean) => {
  const { cacheInfo, coordKey, attributes } = stateItem;
  const { axis, coord, sizeRange, coordRange } = cacheInfo;
  const axisCenter = (axis as IPolarAxis).getCenter();
  const center = {
    x: axisCenter.x + layoutStartPoint.x,
    y: axisCenter.y + layoutStartPoint.y
  };

  if (coordKey === 'angle') {
    const crosshairType = attributes.type === 'rect' ? 'sector' : 'line';

    if (crosshairType === 'sector') {
      // angle 轴对应的crosshair
      return {
        center,
        innerRadius: (axis as IPolarAxis).getInnerRadius(),
        radius: (axis as IPolarAxis).getOuterRadius(),
        startAngle: coordRange[0],
        endAngle: coordRange[1]
      };
    }
    // angle 轴对应的crosshair
    return {
      start: polarToCartesian(center, (axis as IPolarAxis).getInnerRadius(), coord),
      end: polarToCartesian(center, (axis as IPolarAxis).getOuterRadius(), coord)
    };
  }

  const startAngle = (axis as IPolarAxis).startAngle;
  const endAngle = (axis as IPolarAxis).endAngle;
  const sides = cacheInfo.sides;

  let polygonRadius = coord;
  if (!smooth) {
    const axisCenter = (axis as IPolarAxis).getCenter();
    // 需要计算半径
    // 获取当前点的角度
    const point = (axis as IPolarAxis).coordToPoint({
      angle: sizeRange[0],
      radius: coord
    });
    const curAngle = getAngleByPoint(axisCenter, point);
    const stepAngle = (endAngle - startAngle) / sides;
    const index = Math.floor((curAngle - startAngle) / stepAngle);
    const preAngle = index * stepAngle + startAngle;
    const nextAngle = Math.min((index + 1) * stepAngle + startAngle, endAngle);

    const prePoint = polarToCartesian(axisCenter, coord, preAngle);
    const nextPoint = polarToCartesian(axisCenter, coord, nextAngle);
    // 求交点
    const insertPoint = getIntersectPoint(
      [nextPoint.x, nextPoint.y],
      [prePoint.x, prePoint.y],
      [axisCenter.x, axisCenter.y],
      [point.x, point.y]
    );
    if (insertPoint) {
      polygonRadius = clamp(
        PointService.distancePN(point, (insertPoint as [number, number])[0], (insertPoint as [number, number])[1]) +
          coord,
        (axis as IPolarAxis).getInnerRadius(),
        (axis as IPolarAxis).getOuterRadius()
      );
    }
  }
  return {
    center,
    startAngle: startAngle,
    endAngle: endAngle,
    radius: polygonRadius,
    sides
  };
};

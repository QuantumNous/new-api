import type { IChart } from '../../../../chart/interface';
import type { IDimensionInfo } from '../interface';
import { isDiscrete } from '@visactor/vscale';
import { getAxis, getDimensionData } from './common';
import type { IPolarSeries } from '../../../../series/interface';
import { isNil, maxInArray, minInArray } from '@visactor/vutils';
import { distance, vectorAngle } from '../../../../util/math';
import type { ILayoutPoint } from '../../../../typings/layout';
import type { PolarAxis } from '../../../../component';
/** 将角度标准化为 range 范围内的角度 */
const angleStandardize = (angle: number, range: [number, number]) => {
  const unit = Math.PI * 2;
  const min = minInArray(range);
  const max = maxInArray(range);
  if (angle < min) {
    angle += Math.ceil((min - angle) / unit) * unit;
  } else if (angle > max) {
    angle -= Math.ceil((angle - max) / unit) * unit;
  }
  return angle;
};

export const getPolarDimensionInfo = (chart: IChart | undefined, pos: ILayoutPoint): IDimensionInfo[] | null => {
  if (!chart) {
    return null;
  }

  const angleAxisList = getAxis(chart, (cmp: PolarAxis) => cmp.getOrient() === 'angle', pos);
  const radiusAxisList = getAxis(chart, (cmp: PolarAxis) => cmp.getOrient() === 'radius', pos);

  if ((!angleAxisList || !angleAxisList.length) && (!radiusAxisList || !radiusAxisList.length)) {
    return null;
  }

  const targetAxisInfo: IDimensionInfo[] = [];

  const getDimensionField = (series: IPolarSeries) => series.getDimensionField()[0];
  const { x, y } = pos;

  if (angleAxisList) {
    angleAxisList.forEach(axis => {
      const angleScale = axis.getScale();
      // 限定为离散轴
      if (angleScale && isDiscrete(angleScale.type)) {
        const angleDomain = angleScale.domain();
        const angleRange = angleScale.range();
        const center = axis.getCenter();
        const vector = {
          x: x - axis.getLayoutStartPoint().x - center.x,
          y: y - axis.getLayoutStartPoint().y - center.y
        };

        // 计算顺时针角度
        let angle = vectorAngle({ x: 1, y: 0 }, vector);
        angle = angleStandardize(angle, angleRange);

        // 计算半径
        const radius = distance(vector);
        const radiusScale = radiusAxisList[0]?.getScale(); // FIXME: 想办法获取到和当前角度轴对应的径向轴，而不是取第一个
        const radiusRange = radiusScale?.range();

        // 判断是否在 range 范围内
        if (
          (angle - angleRange?.[0]) * (angle - angleRange?.[1]) > 0 ||
          (radius - radiusRange?.[0]) * (radius - radiusRange?.[1]) > 0
        ) {
          return;
        }

        const value = axis.invert(angle);
        if (isNil(value)) {
          return;
        }
        let index: number | undefined = angleDomain.findIndex((v: any) => v?.toString() === value.toString());
        if (index < 0) {
          index = undefined;
        }

        const data = getDimensionData(value, axis, 'polar', getDimensionField);
        targetAxisInfo.push({ index, value, position: angleScale.scale(value), axis, data });
      }
    });
  }
  if (radiusAxisList) {
    radiusAxisList.forEach(axis => {
      const radiusScale = axis.getScale();
      const radiusRange = radiusScale?.range();

      // 限定为离散轴
      if (radiusScale && isDiscrete(radiusScale.type)) {
        const center = axis.getCenter();
        const vector = {
          x: x - axis.getLayoutStartPoint().x - center.x,
          y: y - axis.getLayoutStartPoint().y - center.y
        };

        // 计算顺时针角度
        let angle = vectorAngle({ x: 1, y: 0 }, vector);
        if (angle < -Math.PI / 2) {
          angle = Math.PI * 2 + angle;
        }

        // 计算半径
        const radius = distance(vector);
        const angleScale = angleAxisList[0]?.getScale(); // FIXME: 想办法获取到和当前径向轴对应的角度轴，而不是取第一个
        const angleRange = angleScale?.range();

        // 判断是否在 range 范围内
        if (
          (angle - angleRange?.[0]) * (angle - angleRange?.[1]) > 0 ||
          (radius - radiusRange?.[0]) * (radius - radiusRange?.[1]) > 0
        ) {
          return;
        }

        const value = radiusScale.invert(radius);
        if (isNil(value)) {
          return;
        }
        const domain = radiusScale.domain();
        let index: number | undefined = domain.findIndex((v: any) => v?.toString() === value.toString());
        if (index < 0) {
          index = undefined;
        }

        const data = getDimensionData(value, axis, 'polar', getDimensionField);
        targetAxisInfo.push({ index, value, position: radiusScale.scale(value), axis, data });
      }
    });
  }
  if (!targetAxisInfo.length) {
    return null;
  }
  return targetAxisInfo;
};

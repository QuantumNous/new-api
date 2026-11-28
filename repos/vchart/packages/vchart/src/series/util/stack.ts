import type { IBaseScale } from '@visactor/vscale';
import type { IStackCacheNode } from '../../util/data';
import { isValueInScaleDomain, valueInScaleRange } from '../../util/scale';
import type { ISeries } from '../interface/series';

export function stackWithMinHeight(
  stackCache: IStackCacheNode,
  stackInverse: boolean,
  context: {
    isVertical: boolean;
    start: string;
    end: string;
    startMethod: string;
    endMethod: string;
    axisHelper: string;
  }
) {
  if (stackCache.values.length > 0) {
    // temp
    let lastY: number;
    // 如果进行了夸系列的排序
    if (stackCache.sortDatums.length) {
      let sortDatums = stackCache.sortDatums;
      if (stackInverse) {
        sortDatums = stackCache.sortDatums.slice().reverse();
      }
      for (let index = 0; index < sortDatums.length; index++) {
        lastY = computeOneDatumY(
          sortDatums[index].datum,
          lastY,
          sortDatums[index].series,
          context,
          sortDatums[index].series[context.axisHelper].getScale?.(0),
          index === 0
        );
      }
    } else {
      // 使用基于系列数据顺序的排序
      // stack one group
      let seriesInfo = stackCache.series;
      if (stackInverse) {
        seriesInfo = seriesInfo.slice().reverse();
      }
      seriesInfo.forEach(({ s, values }, sIndex) => {
        const seriesScale = s[context.axisHelper].getScale?.(0);
        // stack
        for (let index = 0; index < values.length; index++) {
          const obj = values[stackInverse ? values.length - 1 - index : index];
          lastY = computeOneDatumY(obj, lastY, s, context, seriesScale, index === 0 && sIndex === 0);
        }
      });
    }
  }
  for (const key in stackCache.nodes) {
    stackWithMinHeight(stackCache.nodes[key], stackInverse, context);
  }
}

function computeOneDatumY(
  obj: any,
  lastY: number,
  s: ISeries,
  context: {
    isVertical: boolean;
    start: string;
    end: string;
    startMethod: string;
    endMethod: string;
    axisHelper: string;
  },
  seriesScale: IBaseScale,
  isFirst: boolean
) {
  // stack info in series
  const barMinHeight = s.getSpec().barMinHeight;
  const inverse = s[context.axisHelper].isInverse();

  const y1 = valueInScaleRange(s[context.startMethod](obj), seriesScale);
  let y = valueInScaleRange(s[context.endMethod](obj), seriesScale);

  if (isFirst) {
    lastY = y1;
  }

  let height = Math.abs(y1 - y);
  if (height <= 0 && !isValueInScaleDomain(obj[s.getStackValueField()], seriesScale)) {
    height = 0;
  } else if (height < barMinHeight) {
    height = barMinHeight;
  }

  let flag = 1;
  if (y < y1) {
    flag = -1;
  } else if (y === y1) {
    flag = context.isVertical ? (inverse ? 1 : -1) : inverse ? -1 : 1;
  }
  y = lastY + flag * height;
  obj[context.start] = lastY;
  obj[context.end] = y;
  return y;
}

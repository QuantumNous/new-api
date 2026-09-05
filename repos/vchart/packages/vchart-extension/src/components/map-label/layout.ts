import type { Feature } from '@visactor/vchart';
import { isPointInPolygon, destination, getAABBFromPoints } from '@visactor/vchart';
import type { IOrientType, IPoint } from '@visactor/vchart';
import type { IRect } from '@visactor/vchart/src/typings/space';

type IBound = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};
export interface IPairInfo {
  /** 矩形信息 */
  rect: IRect;
  /** 对应点的画布坐标 */
  point: IPoint;
  /** 对应点的经纬度坐标 */
  pointCoord?: IPoint;
  /** 基于锚点的可放置位置 */
  anchors?: IOrientType[];
  /** 距离锚点的位置偏移量 */
  offset?: number;
  /** 原始顺序 */
  index: number;
}

function overlap<T extends IBound>(a: T, b: T, sep = 0) {
  return sep > Math.max(b.x1 - a.x2, a.x1 - b.x2, b.y1 - a.y2, a.y1 - b.y2);
}

export function bound(rect: IRect): IBound {
  return {
    x1: rect.x,
    x2: rect.x + rect.width,
    y1: rect.y,
    y2: rect.y + rect.height
  };
}

function toRect(bound: IBound): IRect {
  return {
    x: bound.x1,
    y: bound.y1,
    width: bound.x2 - bound.x1,
    height: bound.y2 - bound.y1
  };
}

/**
 * 根据可选位置进行躲避布局
 * @param pairs
 * @returns
 */
export function layoutByPosition(pairs: IPairInfo[]): IRect[] {
  if (!pairs || pairs.length === 0) {
    return [];
  }

  // 只有一个无需布局
  if (pairs.length === 1) {
    return [pairs[0].rect];
  }

  const _pairs = pairs.map(pair => {
    return {
      ...pair,
      bound: bound(pair.rect),
      anchorCandidates: candidatesByOrient(pair.anchors ?? [], pair.point!, pair.rect, pair.offset)
    };
  });

  const resultBound: IBound[] = [];
  // 默认布局第一个
  resultBound.push(_pairs[0].bound);

  for (let i = 1; i <= _pairs.length - 1; i++) {
    const curPair = _pairs[i];
    const curBound = curPair.bound;
    // 遍历检测
    let isOverlap = resultBound.some(r => overlap(r, curBound));
    if (!curPair.anchorCandidates) {
      continue;
    }
    if (isOverlap && curPair.anchorCandidates?.length > 0) {
      for (let j = 0; j < curPair.anchorCandidates.length; j++) {
        const anchor = curPair.anchorCandidates[j];
        const newBound = {
          x1: anchor.x,
          y1: anchor.y,
          x2: anchor.x + curBound.x2 - curBound.x1,
          y2: anchor.y + curBound.y2 - curBound.y1,
          anchor
        };
        if (!resultBound.some(r => overlap(r, newBound))) {
          resultBound.push(newBound);
          isOverlap = false;
          break;
        }
      }
      if (isOverlap) {
        // 所有候选位置都放不下
        resultBound.push(curPair.bound);
      }
    } else {
      resultBound.push(curPair.bound);
    }
  }

  return resultBound.map(bound => toRect(bound));
}

export function layoutOuter(
  pairs: IPairInfo[],
  features: Feature[],
  dataToPosition: (coord: number[]) => IPoint | null
): IRect[] {
  // 1. 计算包围圆
  const _points = pairs.map(rect => rect.pointCoord);
  const { x1, x2, y1, y2 } = getAABBFromPoints(_points);
  const geoCenter = [(x1 + x2) / 2, (y1 + y2) / 2];
  const centerPosition = dataToPosition(geoCenter);

  if (!centerPosition) {
    return [];
  }

  // 2. 遍历每个rect
  // anchor与圆心的交点方向，尝试寻找不在地图区域内部的新锚点
  const result = pairs.map(pair => {
    const rect = pair.rect;
    const targetPoint = !isPointWithinFeatures(features, pair.pointCoord!)
      ? pair.point
      : dataToPosition(
          nearestPoint(
            features,
            [pair.pointCoord!.x, pair.pointCoord!.y],
            uniformDegree(lineDegree(pair.point!, centerPosition))
          )
        );

    if (targetPoint) {
      rect.x = targetPoint.x;
      rect.y = targetPoint.y;
    }
    // 3. 根据finalAnchor在包围圆上的位置，调整rect的位置
    // 将圆根据圆心角划分为4个区域，对应不同的position

    const degree = uniformDegree(lineDegree(pair.point!, centerPosition));

    let position: IOrientType;
    const anchors: IOrientType[] = [];
    if (degree >= -45 && degree < 45) {
      position = 'top';
      anchors.push('left', 'right');
    } else if (degree >= 45 && degree < 135) {
      position = 'right';
    } else if (degree >= -135 && degree < -45) {
      position = 'left';
      anchors.push('left');
    } else {
      position = 'bottom';
      anchors.push('left', 'right');
    }
    pair.anchors = anchors;
    pair.offset = 20;
    pair.rect = placeRectByOrient(pair.rect, position, 0);
    return pair;
  });

  return layoutByPosition(result);
}

export function layoutOuter2(
  pairs: IPairInfo[],
  features: Feature[],
  dataToPosition: (coord: number[]) => IPoint | null
): IRect[] {
  // 1. 计算几何中心
  let x = 0;
  let y = 0;
  for (let i = 0; i < pairs.length; i++) {
    x += pairs[i].pointCoord.x;
    y += pairs[i].pointCoord.y;
  }
  x /= pairs.length;
  y /= pairs.length;
  const centerPosition = dataToPosition([x, y]);
  if (!centerPosition) {
    return [];
  }

  const count = pairs.length;

  // 2. 按照圆心角排序
  pairs.sort((a, b) => {
    return lineDegree(centerPosition, a.point) - lineDegree(centerPosition, b.point);
  });

  const result = pairs.map((pair, index) => {
    let degree = (360 / count) * index;
    const _degree = lineDegree(centerPosition, pair.point);
    degree = uniformDegree((degree + _degree) / 2);
    const targetPoint = !isPointWithinFeatures(features, pair.pointCoord)
      ? pair.point
      : dataToPosition(nearestPoint(features, [pair.pointCoord.x, pair.pointCoord.y], degree));
    if (targetPoint) {
      pair.rect.x = targetPoint.x;
      pair.rect.y = targetPoint.y;
    }
    // 3. 根据finalAnchor在包围圆上的位置，调整rect的位置
    // 将圆根据圆心角划分为4个区域，对应不同的position
    let position: IOrientType;
    const anchors: IOrientType[] = [];
    if (degree >= -45 && degree < 45) {
      position = 'top';
      anchors.push('left', 'right');
    } else if (degree >= 45 && degree < 135) {
      position = 'right';
    } else if (degree >= -135 && degree < -45) {
      position = 'left';
      anchors.push('left');
    } else {
      position = 'bottom';
      anchors.push('left', 'right');
    }

    pair.anchors = anchors;
    pair.offset = 20;
    pair.rect = placeRectByOrient(pair.rect, position, 0);
    return pair;
  });

  return layoutByPosition(result.sort((a, b) => a.index - b.index));
}

function uniformDegree(degree: number) {
  return degree > 180 ? degree - 360 : degree;
}

function lineDegree(start: IPoint, end: IPoint) {
  return (Math.atan2(start.y - end.y, start.x - end.x) * 180) / Math.PI + 90;
}

function nearestPoint(features: Feature[], origin: number[], bearing: number, distance = 200) {
  const count = 5621 / distance;
  let curOrigin = origin;
  for (let i = 1; i <= count; i++) {
    const dest = destination(curOrigin as unknown as IPoint, distance, bearing);
    if (!isPointWithinFeatures(features, dest)) {
      return [dest.x, dest.y];
    }
    curOrigin = [dest.x, dest.y];
  }
  return origin;
}

function isPointWithinFeatures(features: Feature[], p: IPoint) {
  for (let i = 0; i < features.length; i++) {
    const inside = isPointInPolygon(p, features[i] as any);
    if (inside) {
      return true;
    }
  }
  return false;
}

/**
 * 以rect左上角为锚点的，根据position位置调整rect布局。
 * @param rect
 * @param position 在锚点的四周位置，'top' | 'bottom' | 'left' | 'right'
 * @param offset rect与锚点间的距离
 * @returns
 */
export function placeRectByOrient(rect: IRect, position: IOrientType, offset = 0) {
  const result: IRect = { ...rect };
  if (position === 'top') {
    result.x -= rect.width / 2;
    result.y -= offset + rect.height / 2;
  } else if (position === 'bottom') {
    result.x -= rect.width / 2;
    result.y += offset - rect.height / 2;
  } else if (position === 'left') {
    result.x -= offset + rect.width;
    result.y -= rect.height / 2;
  } else if (position === 'right') {
    result.x += offset;
    result.y -= rect.height / 2;
  }
  return result;
}

export function candidatesByOrient(
  positions: IOrientType[],
  anchor: IPoint,
  rect: Pick<IRect, 'width' | 'height'>,
  offset = 0
) {
  const candidates: IPoint[] = [];
  positions.forEach((p: IOrientType) => {
    const { x, y } = placeRectByOrient({ ...anchor, width: rect.width, height: rect.height }, p, offset);
    candidates.push({ x, y });
  });
  return candidates;
}

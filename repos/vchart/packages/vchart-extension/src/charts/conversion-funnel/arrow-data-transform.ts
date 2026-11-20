import type { IPointLike } from '@visactor/vchart';
import type { IConversionFunnelSpec, Arrow } from './interface';
import { isValid, isValidNumber, maxInArray } from '@visactor/vchart';
import { isArrowCross, isSameArrow } from './util';

export interface ParsedArrow extends Arrow {
  position: 'left' | 'right';
  distance: number;
  /** 层级跨度 */
  span: number;
  layout: {
    isLayout: boolean;
    duplicateNode: ParsedArrow | null;
    fromIndex: number;
    toIndex: number;
    fromTotal: number;
    toTotal: number;
    level: number;
    points: IPointLike[];
  };
  context: {
    field: string;
  };
  id: string;
}

export const conversionArrowTransform = (
  arrowSpec: IConversionFunnelSpec['conversionArrow'],
  options: {
    categoryField: string;
  }
) => {
  if (!arrowSpec || !arrowSpec.arrows?.length) {
    return [];
  }
  const { arrows } = arrowSpec;

  const parsedArrows = parseArrow(arrows, options.categoryField);
  const leftArrows = parsedArrows.filter(arrow => arrow.position === 'left');
  const rightArrows = parsedArrows.filter(arrow => arrow.position === 'right');

  const left = computeArrows(leftArrows) ?? [];
  const right = computeArrows(rightArrows) ?? [];
  return [...left, ...right];
};

function parseArrow(arrows: Arrow[], categoryField: string): ParsedArrow[] {
  return arrows
    .filter(arrow => isValidNumber(arrow.from * arrow.to))
    .map((arrow, index) => {
      const { from, to, position = 'right' } = arrow;
      return {
        ...arrow,
        position,
        distance: arrow.distance || 40,
        from: Math.min(from, to),
        to: Math.max(from, to),
        span: Math.abs(from - to),
        isLayout: false,
        context: {
          field: categoryField
        },
        layout: {
          level: 0
        },
        id: `${from}-${to}-${position}-${index}`
      } as unknown as ParsedArrow;
    });
}

function computeArrows(arrows: ParsedArrow[]) {
  if (arrows?.length === 0) {
    return null;
  }

  const nodeDegreeMap = new Map<
    number,
    {
      fromArrows: ParsedArrow[];
      toArrows: ParsedArrow[];
      totalArrows: ParsedArrow[];
      degree: number;
    }
  >();

  arrows.forEach(arrow => {
    const fromNodeDegree = nodeDegreeMap.get(arrow.from);
    if (isValid(fromNodeDegree)) {
      const firstNodeWidthSameFromTo = fromNodeDegree.fromArrows.find(node => isSameArrow(node, arrow));
      if (!firstNodeWidthSameFromTo) {
        fromNodeDegree.degree += 1;
      } else {
        arrow.layout.duplicateNode = firstNodeWidthSameFromTo;
      }
      fromNodeDegree.fromArrows.push(arrow);
    } else {
      nodeDegreeMap.set(arrow.from, {
        fromArrows: [arrow],
        toArrows: [],
        totalArrows: [],
        degree: 1
      });
    }

    const toNodeDegree = nodeDegreeMap.get(arrow.to);
    if (isValid(toNodeDegree)) {
      const firstNodeWidthSameFromTo = toNodeDegree.toArrows.find(node => isSameArrow(node, arrow));
      if (!firstNodeWidthSameFromTo) {
        toNodeDegree.degree += 1;
      } else {
        arrow.layout.duplicateNode = firstNodeWidthSameFromTo;
      }
      toNodeDegree.toArrows.push(arrow);
    } else {
      nodeDegreeMap.set(arrow.to, {
        toArrows: [arrow],
        fromArrows: [],
        totalArrows: [],
        degree: 1
      });
    }
  });
  nodeDegreeMap.forEach(node => {
    // 入边，层级跨度越大的越靠下
    node.fromArrows.sort((a, b) => b.span - a.span);
    // 出边，层级跨度越大的越靠上
    node.toArrows.sort((a, b) => a.span - b.span);
    // 入边在上，出边在下
    node.totalArrows = [...node.toArrows, ...node.fromArrows];
  });

  arrows
    .sort((a, b) => a.span - b.span)
    .forEach(arrow => {
      const arrowsIsLayout = arrows.filter(arrow => arrow.layout.isLayout);
      // 1. 计算当前箭头所在层级
      const maxLevelArrow = maxInArray(arrowsIsLayout, (cur, curMax) => cur.layout.level - curMax.layout.level);

      let level = maxLevelArrow?.layout.level ?? 0;
      while (level >= 0) {
        // eslint-disable-next-line no-loop-func
        if (arrowsIsLayout.some(arr => arr.layout.level === level && isArrowCross(arr, arrow))) {
          level += 1;
          break;
        }
        --level;
      }
      arrow.layout.level = Math.max(0, level);
      // 2. 获取当前箭头所在层级的出入度信息
      arrow.layout.fromTotal = nodeDegreeMap.get(arrow.from).degree;
      arrow.layout.toTotal = nodeDegreeMap.get(arrow.to).degree;
      // 3. 计算 from 和 to 的顺序
      const duplicateNode = arrow.layout.duplicateNode;
      if (duplicateNode) {
        arrow.layout.fromIndex = duplicateNode.layout.fromIndex;
        arrow.layout.toIndex = duplicateNode.layout.toIndex;
      } else {
        arrow.layout.fromIndex = computeIndex(arrow, nodeDegreeMap.get(arrow.from).totalArrows);
        arrow.layout.toIndex = computeIndex(arrow, nodeDegreeMap.get(arrow.to).totalArrows);
      }
      arrow.layout.isLayout = true;
    });

  return arrows;
}

function computeIndex(arrow: ParsedArrow, totalArrows: ParsedArrow[]) {
  let index = 0;
  let duplicateCount = 0;
  for (let i = 0; i < totalArrows.length; i++) {
    const curArrow = totalArrows[i];
    if (curArrow === arrow) {
      index = i - duplicateCount;
      break;
    }
    if (curArrow.layout.duplicateNode) {
      duplicateCount++;
    }
  }
  return index;
}

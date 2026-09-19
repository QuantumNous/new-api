/**
 * @description vchart 自定义组件，用于实现 bar、area、line 这些图形的截断图形生成
 * @author zhangweixing
 */

import type { Point, IGraphic } from '@visactor/vchart';
import { AbstractComponent, createGroup, createPath } from '@visactor/vchart';
import type { SeriesBreakAttrs, SeriesBreakData } from './type';
import { isEmpty, isNumberClose, isValid } from '@visactor/vchart';
import { SERIES_BREAK } from './constant';
import { Factory } from '@visactor/vchart';

/**
 * 求锯齿的路径（一个锯齿由向上和向下的两个线段组成）
 * @param start 锯齿的起始点
 * @param end 锯齿的结束点
 * @param size 锯齿的高度
 * @param angle 锯齿的角度
 * @param gap 两条锯齿的间距
 * @param isVertical 是否垂直
 * @returns
 */
function generateZigzagPath(start: Point, end: Point, size: number, angle: number, isVertical = false) {
  const path = [];
  const { x: startX, y: startY } = start;
  const { x: endX, y: endY } = end;

  // 计算锯齿的数量
  const numZigzags = isVertical ? Math.floor((endY - startY) / (size * 2)) : Math.floor((endX - startX) / (size * 2));

  // 计算倾斜角度的增量
  const angleRad = (Math.PI / 180) * angle; // 转换为弧度
  const deltaX = size * Math.cos(angleRad);
  const deltaY = size * Math.sin(angleRad);

  // 添加第一条锯齿的起始点
  path.push(`M ${startX} ${startY}`);

  for (let i = 0; i <= numZigzags; i++) {
    const x = isVertical ? startX + (i % 2 === 0 ? deltaX : -deltaX) : startX + i * size * 2;
    const y = isVertical ? startY + i * size * 2 : i % 2 === 0 ? startY - deltaY : startY + deltaY;
    path.push(`L ${x} ${y}`);
  }

  // 添加第一条锯齿的结束点
  path.push(`L ${isVertical ? startX : endX} ${isVertical ? endY : startY}`);

  return path.join(' ');
}

const checkOverlap = (prevData: SeriesBreakData[], newEntry: SeriesBreakData) => {
  const { start, end } = newEntry;
  const isVertical = start.x === end.x;
  const equalDim = isVertical ? 'x' : 'y';
  const diffDim = isVertical ? 'y' : 'x';
  let needAppend = true;
  const EPS = 1e-6;

  if (prevData.length) {
    prevData.forEach(prevEntry => {
      if (isNumberClose(prevEntry.start[equalDim], start[equalDim])) {
        // 判断是否有重叠，有重叠取交集
        const minDim = Math.min(start[diffDim], end[diffDim]);
        const maxDim = Math.max(start[diffDim], end[diffDim]);
        const prevMinDim = Math.min(prevEntry.start[diffDim], prevEntry.end[diffDim]);
        const prevMaxDim = Math.max(prevEntry.start[diffDim], prevEntry.end[diffDim]);
        const hasOverlap = !(maxDim < prevMinDim - EPS || minDim > prevMaxDim + EPS);

        if (hasOverlap) {
          prevEntry.start[diffDim] = Math.min(prevMinDim, minDim);
          prevEntry.end[diffDim] = Math.max(prevMaxDim, maxDim);
          needAppend = false;
          return;
        }
      }
    });
  }

  if (needAppend) {
    prevData.push(newEntry);
  }
};

export class SeriesBreakComponent extends AbstractComponent<Required<SeriesBreakAttrs>> {
  name = SERIES_BREAK;
  protected render() {
    this.removeAllChild();
    const { data = [] } = this.attribute as SeriesBreakAttrs;
    if (isEmpty(data)) {
      return;
    }
    // 去除重叠数据
    const verticalData: SeriesBreakData[] = [];
    const horizontalData: SeriesBreakData[] = [];

    data.forEach(breakData => {
      const { start, end } = breakData;
      const isVertical = start.x === end.x;

      checkOverlap(isVertical ? verticalData : horizontalData, breakData);
    });

    [...verticalData, ...horizontalData].forEach((breakData, id) => {
      const { start, end, size = 4, gap = 5, style = {}, ...rest } = breakData;
      const breakGroup = createGroup({});
      const isVertical = start.x === end.x;

      let startPathStart;
      let startPathEnd;
      let endPathStart;
      let endPathEnd;
      if (isVertical) {
        startPathStart = {
          x: start.x - gap / 2,
          y: start.y
        };
        startPathEnd = {
          x: end.x - gap / 2,
          y: end.y
        };
        endPathStart = {
          x: start.x + gap / 2,
          y: start.y
        };
        endPathEnd = {
          x: end.x + gap / 2,
          y: end.y
        };
      } else {
        startPathStart = {
          x: start.x,
          y: start.y - gap / 2
        };
        startPathEnd = {
          x: end.x,
          y: end.y - gap / 2
        };
        endPathStart = {
          x: start.x,
          y: start.y + gap / 2
        };
        endPathEnd = {
          x: end.x,
          y: end.y + gap / 2
        };
      }

      const startPath = generateZigzagPath(startPathStart, startPathEnd, size, isVertical ? 75 : 15, isVertical);
      const centerPath = generateZigzagPath(start, end, size, isVertical ? 75 : 15, isVertical);
      const endPath = generateZigzagPath(endPathStart, endPathEnd, size, isVertical ? 75 : 15, isVertical);
      breakGroup.add(
        createPath({
          path: startPath,
          stroke: '#000',
          lineWidth: 1,
          ...style,
          pickable: false,
          zIndex: 1
        })
      );
      breakGroup.add(
        createPath({
          path: endPath,
          stroke: '#000',
          lineWidth: 1,
          ...style,
          pickable: false,
          zIndex: 1
        })
      );
      breakGroup.add(
        createPath({
          path: centerPath,
          stroke: '#fff',
          lineWidth: gap,
          pickable: false,
          zIndex: 0
        })
      );

      breakGroup.name = 'series-break';
      breakGroup.data = rest;

      if (isValid(rest.axisId)) {
        breakGroup.id = `${rest.axisId ?? ''}_${id}`;
      }

      this.add(breakGroup);
    });
  }
}

export const registerSeriesBreak = () => {
  Factory.registerGraphicComponent(
    'seriesBreak',
    (attrs: Required<SeriesBreakAttrs>) => new SeriesBreakComponent(attrs) as unknown as IGraphic
  );
};

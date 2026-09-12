/**
 * 支持轴翻转
 */
import type { ILinearAxisBreakSpec, ILinearAxisSpec } from '@visactor/vchart/esm/component/axis';
import type { ICartesianSeries, IMarkGraphic, ISpec } from '@visactor/vchart';
import type { SeriesBreakData } from './type';
import type { IPointLike } from '@visactor/vchart';
import { array, getIntersectPoint, isValid, PointService } from '@visactor/vchart';
import type { IArea, ILine, Point } from '@visactor/vchart';
import { getAllRegionBounds } from '../../utils/element';
import { isNumberEqual } from '../../utils/math';
import { SERIES_BREAK } from './constant';

const barOffset = 2;
const lineOffset = 10;
const areaOffset = 0;

/**
 * 获取系列标签的 spec 配置
 * @param position 显示位置
 * @param config 系列标签的样式配置
 * @returns
 */
export function getSeriesBreakConfig(axesSpec: ILinearAxisSpec[], axesIndex?: number[]) {
  return {
    type: 'component',
    componentType: SERIES_BREAK,
    interactive: true,
    zIndex: 500,

    style: {
      data: (datum: any, ctx: any) => {
        const seriesBreakData: SeriesBreakData[] = [];
        const vchart = ctx.vchart;
        const chart = vchart.getChart();
        const series = chart.getAllSeries()[0] as ICartesianSeries;
        const isHorizontal = series.direction === 'horizontal';
        axesSpec.forEach((spec: any, index: number) => {
          const axisId = spec.id;
          const axisModel = isValid(axisId)
            ? chart.getComponentByUserId(axisId)
            : axesIndex && isValid(axesIndex[index])
            ? chart.getComponentByIndex('axes', axesIndex[index])
            : chart.getComponentsByKey('axes').filter((axis: { getSpec: () => any }) => {
                const axisInnerSpec = axis.getSpec();

                return axisInnerSpec.breaks === spec.breaks;
              })?.[0];

          if (!axisModel) {
            return;
          }
          const parsedAxisId = axisId ?? `${axisModel.type}-${axisModel.id}`;

          const regionBounds = getAllRegionBounds(axisModel.getRegions());

          // todo 这里用到了内部变量，不太安全
          array(axisModel._break?.breaks).forEach((breakConfig: ILinearAxisBreakSpec) => {
            const { range, breakSymbol, gap = 5 } = breakConfig;
            const pos1 = axisModel.valueToPosition(range[0]);
            const pos2 = axisModel.valueToPosition(range[1]);

            const posY = (pos1 + pos2) / 2 + (isHorizontal ? regionBounds.x1 : regionBounds.y1);

            chart.getAllSeries().forEach((s: ICartesianSeries) => {
              if (s.type === 'bar' || s.type === 'waterfall') {
                const mark = s.getMarkInName('bar');
                const graphics = mark.getGraphics();

                graphics.forEach((element: IMarkGraphic) => {
                  const elementBounds = element.AABBBounds;
                  let shouldDrawBreak = false;
                  let startX;
                  let startY;
                  let endX;
                  let endY;
                  if (isHorizontal) {
                    shouldDrawBreak =
                      elementBounds.x1 < (pos1 + pos2 - (gap as number)) / 2 &&
                      elementBounds.x2 > (pos1 + pos2 + gap) / 2;

                    startX = posY;
                    startY = Math.max(elementBounds.y1 + regionBounds.y1 - barOffset, regionBounds.y1);

                    endX = posY;
                    endY = Math.min(elementBounds.y2 + regionBounds.y1 + barOffset, regionBounds.y2);
                  } else {
                    shouldDrawBreak =
                      elementBounds.y1 < (pos1 + pos2 - (gap as number)) / 2 &&
                      elementBounds.y2 > (pos1 + pos2 + gap) / 2;
                    startX = Math.max(elementBounds.x1 + regionBounds.x1 - barOffset, regionBounds.x1);
                    startY = posY;
                    endX = Math.min(elementBounds.x2 + regionBounds.x1 + barOffset, regionBounds.x2);
                    endY = posY;
                  }

                  if (shouldDrawBreak) {
                    seriesBreakData.push({
                      start: {
                        x: startX,
                        y: startY
                      },
                      end: {
                        x: endX,
                        y: endY
                      },
                      gap: gap as number,
                      style: breakSymbol?.style,
                      axisId: parsedAxisId,
                      data: range
                    });
                  }
                });
              } else if (s.type === 'line') {
                // 求水平直线/垂直线同 line path 的交点
                const mark = s.getMarkInName(s.type);
                const graphics = mark.getGraphics();
                graphics.forEach(graphicItem => {
                  const points = getAreaOrLinePathPoints(graphicItem, 'line');
                  points.forEach(linePoints => {
                    // 开始查找交点
                    const intersections = getIntersectionsFromLineAndPolyline(
                      isHorizontal
                        ? {
                            start: { x: (pos1 + pos2) / 2, y: 0 },
                            end: { x: (pos1 + pos2) / 2, y: regionBounds.y2 - regionBounds.y1 }
                          }
                        : {
                            start: { x: 0, y: (pos1 + pos2) / 2 },
                            end: { x: regionBounds.x2 - regionBounds.x1, y: (pos1 + pos2) / 2 }
                          },
                      linePoints
                    );

                    intersections.forEach(intersection => {
                      let start;
                      let end;
                      if (isHorizontal) {
                        start = {
                          x: posY,
                          y: Math.max(intersection[1] + regionBounds.y1 - lineOffset, regionBounds.y1)
                        };
                        end = {
                          x: posY,
                          y: Math.min(intersection[1] + regionBounds.y1 + lineOffset, regionBounds.y2)
                        };
                      } else {
                        start = {
                          x: Math.max(intersection[0] + regionBounds.x1 - lineOffset, regionBounds.x1),
                          y: posY
                        };
                        end = {
                          x: Math.min(intersection[0] + regionBounds.x1 + lineOffset, regionBounds.x2),
                          y: posY
                        };
                      }
                      seriesBreakData.push({
                        start,
                        end,
                        gap: gap as number,
                        style: breakSymbol?.style,
                        axisId: parsedAxisId,
                        data: range
                      });
                    });
                  });
                });
              } else if (s.type === 'area') {
                // 默认面积去全部堆叠
                const mark = s.getMarkInName('area');
                const graphics = mark.getGraphics();
                graphics.forEach(graphicItem => {
                  const points = getAreaOrLinePathPoints(graphicItem, 'area');
                  points.forEach(areaPoints => {
                    const intersections = getIntersectionsFromLineAndPolyline(
                      isHorizontal
                        ? {
                            start: { x: (pos1 + pos2) / 2, y: 0 },
                            end: { x: (pos1 + pos2) / 2, y: regionBounds.y2 - regionBounds.y1 }
                          }
                        : {
                            start: { x: 0, y: (pos1 + pos2) / 2 },
                            end: { x: regionBounds.x2 - regionBounds.x1, y: (pos1 + pos2) / 2 }
                          },
                      areaPoints
                    );

                    intersections.sort((a, b) => a[0] - b[0]);

                    for (let index = 0; index < intersections.length - 1; index++) {
                      const lineStart = {
                        x: intersections[index][0],
                        y: intersections[index][1]
                      };
                      const lineEnd = {
                        x: intersections[index + 1][0],
                        y: intersections[index + 1][1]
                      };
                      if (
                        isPointInPolygon(
                          isHorizontal
                            ? {
                                x: lineStart.x,
                                y: (lineStart.y + lineEnd.y) / 2
                              }
                            : {
                                x: (lineStart.x + lineEnd.x) / 2,
                                y: lineStart.y
                              },
                          areaPoints
                        )
                      ) {
                        let start;
                        let end;
                        if (isHorizontal) {
                          start = {
                            x: lineStart.x + regionBounds.x1,
                            y: Math.max(lineStart.y + regionBounds.y1 - areaOffset, regionBounds.y1)
                          };
                          end = {
                            x: lineEnd.x + regionBounds.x1,
                            y: Math.min(lineEnd.y + regionBounds.y1 + areaOffset, regionBounds.y2)
                          };
                        } else {
                          start = {
                            x: Math.max(lineStart.x + regionBounds.x1 - areaOffset, regionBounds.x1),
                            y: lineStart.y + regionBounds.y1
                          };
                          end = {
                            x: Math.min(lineEnd.x + regionBounds.x1 + areaOffset, regionBounds.x2),
                            y: lineEnd.y + regionBounds.y1
                          };
                        }
                        seriesBreakData.push({
                          start,
                          end,
                          gap: gap as number,
                          style: breakSymbol?.style,
                          axisId: parsedAxisId,
                          data: range
                        });
                      }
                    }
                  });
                });
              }
            });
          });
        });

        return seriesBreakData;
      }
    }
  };
}

function getIntersectionsFromLineAndPolyline(line: { start: Point; end: Point }, points: Point[]) {
  const intersections: [number, number][] = [];
  for (let index = 1; index < points.length; index++) {
    const intersection = getIntersectPoint(
      [line.start.x, line.start.y],
      [line.end.x, line.end.y],
      [points[index].x, points[index].y],
      [points[index - 1].x, points[index - 1].y]
    );
    if (
      intersection &&
      !intersections.find(point =>
        isNumberEqual(
          PointService.distancePP(
            { x: point[0], y: point[1] },
            { x: (intersection as [number, number])[0], y: (intersection as [number, number])[1] }
          ),
          0
        )
      )
    ) {
      intersections.push(intersection as [number, number]);
    }
  }
  return intersections;
}

function getAreaOrLinePathPoints(shape: IArea | ILine, type: 'line' | 'area') {
  const { points, segments } = shape.attribute;
  const pathPoints: Point[][] = [];
  let eachPathPoints: Point[] = [];
  const parsePoints = (points: IPointLike[]) => {
    if (points && points.length) {
      let basePoints: IPointLike[] = [];
      points.forEach(point => {
        if (point.defined === false) {
          pathPoints.push(eachPathPoints);
          if (type === 'area' && basePoints.length) {
            for (let i = basePoints.length - 1; i >= 0; i--) {
              eachPathPoints.push({
                x: basePoints[i].x,
                y: basePoints[i].y
              });
            }

            eachPathPoints.push(eachPathPoints[0]);
          }
          eachPathPoints = [];
          basePoints = [];
        } else {
          eachPathPoints.push({
            x: point.x,
            y: point.y
          });

          type === 'area' && basePoints.push({ x: point.x1 ?? point.x, y: point.y1 ?? point.y });
        }
      });

      if (type === 'area' && basePoints.length) {
        for (let i = basePoints.length - 1; i >= 0; i--) {
          eachPathPoints.push({
            x: basePoints[i].x,
            y: basePoints[i].y
          });
        }
        eachPathPoints.push(eachPathPoints[0]);
      }

      pathPoints.push(eachPathPoints);
    }
  };

  if (points && points.length) {
    parsePoints(points);
  } else if (segments && segments.length) {
    segments.forEach(seg => {
      parsePoints(seg.points);
    });
  }

  return pathPoints;
}

function isPointInPolygon(point: Point, polygon: Point[]) {
  const { x, y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

export const appendSeriesBreakConfig = (rawSpec: ISpec) => {
  if (rawSpec.axes?.length) {
    const breakedAxes = (rawSpec.axes as any[]).filter(
      (axis: any) => axis.breaks && axis.breaks.length && (axis as any).visible !== false
    );

    if (breakedAxes.length) {
      (rawSpec as any).customMark = array((rawSpec as any).customMark).filter(
        (obj: any) => obj.componentType !== SERIES_BREAK
      );
      (rawSpec as any).customMark.push(
        getSeriesBreakConfig(
          breakedAxes as ILinearAxisSpec[],
          breakedAxes.map((axisSpec: any) => {
            return rawSpec.axes.indexOf(axisSpec as any);
          })
        )
      );
      return true;
    }
  }

  return false;
};

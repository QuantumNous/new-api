import type { ICartesianSeries, IMarkGraphic, ISpec } from '@visactor/vchart';
import type { IText, TextAlignType, TextBaselineType } from '@visactor/vchart';
import { last, type IBoundsLike, array, get } from '@visactor/vchart';
import type { SeriesLabelAttrs, SeriesLabelData, SeriesLabelSpec } from './type';
import { SERIES_LABEL } from './constant';

function range(start: number, stop?: any, step?: any) {
  start = +start;
  stop = +stop;

  let n = arguments.length;
  step = n < 2 ? ((stop = start), (start = 0), 1) : n < 3 ? 1 : +step;

  let i = -1;
  n = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  const range = new Array(n);

  while (++i < n) {
    range[i] = start + i * step;
  }

  return range;
}

function ascending(a: number, b: number) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

/**
 * 文本垂直方向的扰动
 * @param positions y 坐标集合
 * @param separation 间距
 * @param maxIter 最大的迭代次数
 * @param maxError
 * @returns
 */
export function dodge(positions: number[], separation = 10, maxIter = 10, maxError = 1e-1) {
  const n = positions.length;
  if (!positions.every(isFinite)) {
    return positions;
  }
  if (!(n > 1)) {
    return positions;
  }
  const index = range(positions.length);
  for (let iter = 0; iter < maxIter; ++iter) {
    index.sort((i, j) => ascending(positions[i], positions[j]));
    let error = 0;
    for (let i = 1; i < n; ++i) {
      let delta = positions[index[i]] - positions[index[i - 1]];
      if (delta < separation) {
        delta = (separation - delta) / 2;
        error = Math.max(error, delta);
        positions[index[i - 1]] -= delta;
        positions[index[i]] += delta;
      }
    }
    if (error < maxError) {
      break;
    }
  }
  return positions;
}

// 检测两个包围盒是否重叠
function isOverlap(box1: IBoundsLike, box2: IBoundsLike) {
  return !(box2.x1 > box1.x2 || box2.x2 < box1.x1 || box2.y1 > box1.y2 || box2.y2 < box1.y1);
}

/**
 * 水平方向的文本扰动算法
 * @param texts 文本实例集合
 * @param separation 间距
 * @param maxIter 最大迭代次数
 */
export function dodgeHorizontal(texts: IText[], separation = 10, maxIter = 10) {
  const n = texts.length;
  let hasOverlap;
  let iter = 0;
  do {
    hasOverlap = false;
    for (let i = 0; i < n; ++i) {
      for (let j = i + 1; j < n; ++j) {
        const box1 = texts[i].AABBBounds;
        const box2 = texts[j].AABBBounds;
        if (isOverlap(box1, box2)) {
          const delta = separation - (box2.x1 - box1.x2);
          if (delta > 0) {
            texts[j].attribute.x += delta;
            box2.x1 += delta;
            box2.x2 += delta;
            hasOverlap = true;
          }
        }
      }
    }
    iter++;
  } while (hasOverlap && iter < maxIter);
}

/**
 * 获取系列标签的 spec 配置
 * @param position 显示位置
 * @param config 系列标签的样式配置
 * @returns
 */
export function getSeriesLabelConfig(
  position: 'start' | 'end' | 'both-ends',
  config: Pick<SeriesLabelAttrs, 'line' | 'label'>
) {
  const { label, line } = config;
  return {
    type: 'component',
    componentType: SERIES_LABEL,
    interactive: false,
    style: {
      position,
      layout: (datum: any, ctx: any) => {
        const vchart = ctx.vchart;
        const series = vchart.getChart().getAllSeries()[0];
        return series.getSpec().direction ?? 'vertical';
      },
      data: (datum: any, ctx: any) => {
        const vchart = ctx.vchart;
        const chart = vchart.getChart();
        const series = chart.getAllSeries()[0] as ICartesianSeries;
        const isTransposed = series.direction === 'horizontal';
        const bandAxisHelper = (isTransposed ? series.getYAxisHelper() : series.getXAxisHelper()) as any;
        const bandAxisScale = bandAxisHelper.getScale?.(0) as any;
        const isBandAxisInverse = bandAxisHelper.isInverse();
        const dimensionField = series.getDimensionField()[0];
        const seriesField = series.getSeriesField() as string;
        const seriesTypes = chart
          .getAllSeries()
          .map((s: ICartesianSeries) => s.type)
          .filter((value: string, index: number, self: string[]) => {
            return self.indexOf(value) === index;
          });
        const labelData: SeriesLabelData[] = [];

        // 系列标签目前不支持不同系列的组合图
        if (seriesTypes.length === 1 && ['bar', 'area', 'line', 'waterfall'].includes(seriesTypes[0])) {
          const positions = position === 'both-ends' ? ['start', 'end'] : [position];
          positions.forEach(pos => {
            const targetValue = pos === 'end' ? last(bandAxisScale.domain()) : bandAxisScale.domain()[0];
            const region = series.getRegion();
            const { x: regionStartX, y: regionStartY } = region.getLayoutStartPoint();
            let i = 0;
            chart.getAllSeries().forEach((s: ICartesianSeries) => {
              const mark = s.getMarkInName(seriesTypes[0] === 'waterfall' ? 'bar' : seriesTypes[0]);
              const graphics = mark.getGraphics();

              graphics.forEach((g: IMarkGraphic) => {
                const data = g.context.data.find((datum: any) => datum[dimensionField] === targetValue);
                if (data) {
                  const graphBounds = g.AABBBounds;

                  let point;
                  let color;
                  if (seriesTypes[0] === 'bar' || seriesTypes[0] === 'waterfall') {
                    point =
                      pos === 'end'
                        ? {
                            x: isTransposed
                              ? (graphBounds.x1 + graphBounds.x2) / 2
                              : isBandAxisInverse
                              ? graphBounds.x1
                              : graphBounds.x2,
                            y: isTransposed
                              ? isBandAxisInverse
                                ? graphBounds.y2
                                : graphBounds.y1
                              : (graphBounds.y1 + graphBounds.y2) / 2
                          }
                        : {
                            x: isTransposed
                              ? (graphBounds.x1 + graphBounds.x2) / 2
                              : isBandAxisInverse
                              ? graphBounds.x2
                              : graphBounds.x1,
                            y: isTransposed
                              ? isBandAxisInverse
                                ? graphBounds.y1
                                : graphBounds.y2
                              : (graphBounds.y1 + graphBounds.y2) / 2
                          };
                    color = g.attribute.fill;
                  } else {
                    point = s.dataToPosition(data);
                    color = g.attribute.stroke || g.attribute.fill;
                  }

                  let textAlign: TextAlignType;
                  let textBaseline: TextBaselineType;
                  if (pos === 'end') {
                    textAlign = isTransposed ? 'center' : isBandAxisInverse ? 'end' : 'start';
                    textBaseline = isTransposed ? (isBandAxisInverse ? 'top' : 'bottom') : 'middle';
                  } else {
                    textAlign = isTransposed ? 'center' : isBandAxisInverse ? 'start' : 'end';
                    textBaseline = isTransposed ? (isBandAxisInverse ? 'bottom' : 'top') : 'middle';
                  }

                  const labelValue = data[seriesField] ?? data[dimensionField];

                  labelData.push({
                    point: {
                      x: point.x + regionStartX,
                      y: point.y + regionStartY
                    },
                    label: labelValue,
                    color: color as string,
                    textAlign,
                    textBaseline,
                    series: s,
                    datum: data,
                    id: `${pos}-${i}`,
                    position: pos
                  });
                  i++;
                }
              });
            });
          });
        }

        return labelData;
      },
      line,
      label: {
        space: 12,
        ...label
      }
    }
  };
}

export function appendSeriesLabelConfig(rawSpec: ISpec, seriesLabelSpec?: SeriesLabelSpec) {
  (rawSpec as any).customMark = array((rawSpec as any).customMark).filter(
    (obj: any) => obj.componentType !== SERIES_LABEL
  );

  if (!seriesLabelSpec) {
    seriesLabelSpec = get(rawSpec, SERIES_LABEL) ?? get(rawSpec.series?.[0], SERIES_LABEL) ?? {};
  }
  if (seriesLabelSpec.visible) {
    const { position = 'end', ...rest } = seriesLabelSpec;
    (rawSpec as any).customMark.push(getSeriesLabelConfig(position, rest));
  }
}

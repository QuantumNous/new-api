/**
 * @description vchart 自定义组件，用于实现柱图、线图以及面积图的系列标签
 * @author zhangweixing
 */

import type { KDEEvaluator } from '@visactor/vchart';
import { array, get, kde, ecdf, last } from '@visactor/vchart';
import type { Datum, ICartesianSeries, ISpec } from '@visactor/vchart';
import { SeriesTypeEnum } from '@visactor/vchart';
import type { HistogramRegressionLineSpec } from './type';
import type { RegressionLineData } from '../regression-line/type';
import { REGRESSION_LINE } from '../regression-line/regression-line';

const getRegressionByType = (type: 'kde' | 'ecdf', data: number[], kdeOptions?: any) => {
  switch (type) {
    case 'kde':
      return kde(data, kdeOptions);
    case 'ecdf':
      return ecdf(data);
  }
};

/**
 * 获取系列标签的 spec 配置
 * @param position 显示位置
 * @param config 系列标签的样式配置
 * @returns
 */
export function getHistogramRegressionLineConfig(
  type: 'kde' | 'ecdf',
  config: Omit<HistogramRegressionLineSpec, 'visible' | 'type'>
) {
  const { line, label, color } = config;
  return {
    type: 'component',
    componentType: REGRESSION_LINE,
    interactive: false,
    zIndex: 500, // 高于柱子
    style: {
      data: (datum: any, ctx: any) => {
        const vchart = ctx.vchart;
        const chart = vchart.getChart();
        const series = chart.getAllSeries().filter((s: any) => s.type === SeriesTypeEnum.bar) as ICartesianSeries[];
        const regressionData: RegressionLineData[] = [];

        // 直方图使用的是bar系列
        if (series && series.length) {
          series.forEach(s => {
            const region = s.getRegion().getLayoutStartPoint();

            const rawData = (s as any)._rawData;
            const data = rawData?.rawData;
            const binTransformOptions = rawData.transformsArr?.find((t: any) => t.type === 'bin')?.options;
            const fieldX = s.fieldX?.[0];
            const scaleY = s.getYAxisHelper().getScale(0);
            const viewData = s.getViewData().latestData;

            if (!data || !data.length || !binTransformOptions?.field || !scaleY || !viewData || !viewData.length) {
              return;
            }
            const simpleData = data.map((entry: Datum) => entry[binTransformOptions.field]);
            const res = getRegressionByType(
              type,
              simpleData,
              type === 'kde'
                ? {
                    bandwidth:
                      viewData[0][binTransformOptions.outputNames?.x1 ?? 'x1'] -
                      viewData[0][binTransformOptions.outputNames?.x0 ?? 'x0']
                  }
                : null
            );
            const N = Math.max(3, Math.floor(simpleData.length / 4));
            const lineData = res.evaluateGrid(N);
            const yRange = scaleY.range();
            const y0 = yRange[0];
            const y1 = last(yRange);
            const scaleR =
              type === 'kde'
                ? (k: number) => {
                    return scaleY.scale(k * data.length * (res as KDEEvaluator).bandwidth);
                  }
                : (e: number) => {
                    return y0 + (y1 - y0) * e;
                  };

            regressionData.push({
              color: color ?? s.getOption().globalScale.getScale('color')?.scale(s.getSeriesKeys()[0]),
              line: lineData.map((ld: Datum) => {
                const d = { [fieldX]: ld.x };
                return {
                  x: s.dataToPositionX(d) + region.x,
                  y: scaleR(ld.y) + region.y
                };
              })
            });
          });
        }

        return regressionData;
      },
      line,
      label
    }
  };
}

export function appendHistogramRegressionLineConfig(
  chartSpec: ISpec,
  spec?: HistogramRegressionLineSpec | HistogramRegressionLineSpec[]
) {
  if (!spec) {
    const seriesSpecs: any[] = Array.isArray(chartSpec.series)
      ? chartSpec.series
      : chartSpec.series
      ? [chartSpec.series]
      : [];

    spec =
      get(chartSpec, REGRESSION_LINE) ??
      get(
        seriesSpecs.find((s: any) => s.type === SeriesTypeEnum.bar),
        REGRESSION_LINE
      );
  }
  const specs = array(spec);

  specs.forEach((s: HistogramRegressionLineSpec) => {
    if (s.visible !== false) {
      if (!(chartSpec as any).customMark) {
        (chartSpec as any).customMark = [];
      }
      const { type, ...rest } = s;
      (chartSpec as any).customMark.push(getHistogramRegressionLineConfig(type, rest));
    }
  });
}

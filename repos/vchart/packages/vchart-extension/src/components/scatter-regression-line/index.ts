/**
 * @description 散点图回归线组件
 * @author kangxiaoting
 */
import {
  array,
  clamper,
  get,
  regressionLinear,
  regressionLogistic,
  regressionLowess,
  regressionPolynomial
} from '@visactor/vchart';
import type { Datum, ICartesianSeries, ISpec } from '@visactor/vchart';
import { SeriesTypeEnum } from '@visactor/vchart';
import type { ScatterRegressionLineSpec } from './type';
import type { RegressionLineData } from '../regression-line/type';
import { REGRESSION_LINE } from '../regression-line/regression-line';

const getRegressionByType = (
  type: 'linear' | 'logisitc' | 'lowess' | 'polynomial',
  data: any[],
  x: (d: any) => number = d => d.x,
  y: (d: any) => number = d => d.y,
  degree?: number
) => {
  switch (type) {
    case 'logisitc':
      return regressionLogistic(data, x, y);
    case 'lowess':
      return regressionLowess(data, x, y);
    case 'polynomial':
      return regressionPolynomial(data, x, y, { degree });
    default:
      return regressionLinear(data, x, y);
  }
};

/**
 * 获取系列标签的 spec 配置
 * @param position 显示位置
 * @param config 系列标签的样式配置
 * @returns
 */
export function getScatterRegressionLineConfig(
  type: 'linear' | 'logisitc' | 'lowess' | 'polynomial',
  config: Omit<ScatterRegressionLineSpec, 'visible' | 'type'>
) {
  const { color, line, confidenceInterval, label } = config;
  return {
    type: 'component',
    componentType: REGRESSION_LINE,
    interactive: false,
    style: {
      data: (datum: any, ctx: any) => {
        const vchart = ctx.vchart;
        const chart = vchart.getChart();
        const series = chart.getAllSeries().filter((s: any) => s.type === SeriesTypeEnum.scatter) as ICartesianSeries[];
        const regressionData: RegressionLineData[] = [];

        // 必须存在散点图系列
        if (series && series.length) {
          series.forEach(s => {
            const start = s.getRegion().getLayoutStartPoint();
            const rect = s.getRegion().getLayoutRect();
            const yClamper = clamper(start.y, start.y + rect.height);
            const colorAttrOptions = s.getColorAttribute();
            const groups = s.getSeriesKeys();
            const data = s.getViewData().latestData;
            const fieldX = s.fieldX?.[0];
            const fieldY = s.fieldY?.[0];

            if (!fieldX || !fieldY || !data || data.length <= 2) {
              return;
            }

            groups.forEach(group => {
              const groupData = data.filter((d: Datum) => d[colorAttrOptions?.field] === group);

              if (!groupData.length) {
                return;
              }
              const { evaluateGrid, confidenceInterval } = getRegressionByType(
                type,
                groupData,
                (datum: Datum) => datum?.[fieldX],
                (datum: Datum) => datum?.[fieldY],
                config.polynomialDegree
              );
              const N = Math.max(3, Math.floor(groupData.length / 4));
              const lineData = evaluateGrid(N);
              const confidenceData = confidenceInterval(N);

              regressionData.push({
                color: color ?? colorAttrOptions?.scale?.scale(group),
                line: lineData.map((ld: Datum) => {
                  const d = { [fieldX]: ld.x, [fieldY]: ld.y };
                  return {
                    x: s.dataToPositionX(d) + start.x,
                    y: yClamper(
                      type === 'logisitc' ? start.y + rect.height * (1 - ld.y) : s.dataToPositionY(d) + start.y
                    )
                  };
                }),
                area: confidenceData.map((c: Datum) => {
                  const d = { [fieldX]: c.x, [fieldY]: c.lower };
                  return {
                    x: s.dataToPositionX(d) + start.x,
                    y: yClamper(s.dataToPositionY(d) + start.y),
                    y1: yClamper(s.dataToPositionY({ [fieldY]: c.upper }) + start.y)
                  };
                })
              });
            });
          });
        }

        return regressionData;
      },
      line,
      confidenceInterval,
      label
    }
  };
}

export function appendScatterRegressionLineConfig(
  chartSpec: ISpec,
  spec?: ScatterRegressionLineSpec | ScatterRegressionLineSpec[]
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
        seriesSpecs.find((s: any) => s.type === SeriesTypeEnum.scatter),
        REGRESSION_LINE
      );
  }

  const specs = array(spec);

  specs.forEach((s: ScatterRegressionLineSpec) => {
    if (s.visible !== false) {
      if (!(chartSpec as any).customMark) {
        (chartSpec as any).customMark = [];
      }

      const { type, ...rest } = s;
      (chartSpec as any).customMark.push(getScatterRegressionLineConfig(type, rest));
    }
  });
}

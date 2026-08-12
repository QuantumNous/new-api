/**
 * @description vchart 自定义组件，用于实现柱图、线图以及面积图的系列标签
 * @author zhangweixing
 */
import { array, clamper, get, regressionPolynomial } from '@visactor/vchart';
import type { Datum, ICartesianSeries, ISpec } from '@visactor/vchart';
import { Direction, SeriesTypeEnum } from '@visactor/vchart';
import type { BarRegressionLineSpec } from './type';
import type { RegressionLineData } from '../regression-line/type';
import { REGRESSION_LINE } from '../regression-line/regression-line';

/**
 * 获取系列标签的 spec 配置
 * @param position 显示位置
 * @param config 系列标签的样式配置
 * @returns
 */
export function getBarRegressionLineConfig(config: Omit<BarRegressionLineSpec, 'visible'>) {
  const { color, line, confidenceInterval, label } = config;
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

        // 必须存在散点图系列
        if (series && series.length) {
          series.forEach(s => {
            const region = s.getRegion().getLayoutStartPoint();
            const start = s.getRegion().getLayoutStartPoint();
            const rect = s.getRegion().getLayoutRect();
            const yClamper = clamper(start.y, start.y + rect.height);

            const data = s.getViewData().latestData;
            const fieldX = s.fieldX?.[0];
            const fieldY = s.fieldY?.[0];
            const isHorizontal = s.direction === Direction.horizontal;
            const groups = s.getRawDataStatisticsByField(fieldX).values;

            if (isHorizontal || !fieldX || !fieldY || !data || data.length <= 2 || groups.length <= 2) {
              return;
            }
            const { evaluateGrid, confidenceInterval } = regressionPolynomial(
              data,
              (datum: Datum) => groups.indexOf(datum?.[fieldX]),
              (datum: Datum) => datum?.[fieldY],
              { degree: config.degree }
            );
            const N = groups.length;
            const lineData = evaluateGrid(N);
            const confidenceData = confidenceInterval(N);
            const halfBandWidth = s.getXAxisHelper().getBandwidth(0) / 2;

            regressionData.push({
              color: color ?? s.getOption().globalScale.getScale('color')?.scale(s.getSeriesKeys()[0]),
              line: lineData.map((ld: Datum) => {
                const d = { [fieldX]: groups[ld.x], [fieldY]: ld.y };
                return {
                  x: s.dataToPositionX(d) + region.x + halfBandWidth,
                  y: yClamper(s.dataToPositionY(d) + region.y)
                };
              }),
              area: confidenceData.map((c: Datum) => {
                const d = { [fieldX]: groups[c.x], [fieldY]: c.lower };
                return {
                  x: s.dataToPositionX(d) + region.x + halfBandWidth,
                  y: yClamper(s.dataToPositionY(d) + region.y),
                  y1: yClamper(s.dataToPositionY({ [fieldY]: c.upper }) + region.y)
                };
              })
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

export function appendBarRegressionLineConfig(chartSpec: ISpec, spec?: BarRegressionLineSpec) {
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

  specs.forEach((s: BarRegressionLineSpec) => {
    if (s.visible !== false) {
      if (!(chartSpec as any).customMark) {
        (chartSpec as any).customMark = [];
      }

      const { visible, ...rest } = s;
      (chartSpec as any).customMark.push(getBarRegressionLineConfig(rest));
    }
  });
}

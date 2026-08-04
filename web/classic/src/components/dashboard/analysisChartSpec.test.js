import { expect, test } from 'bun:test';
import { CartesianChartSpecTransformer } from '@visactor/vchart/cjs/chart/cartesian/cartesian-transformer.js';
import {
  buildAnalysisModelChartSpec,
  buildAnalysisTrendChartSpec,
} from './analysisChartSpec';

const transformSpec = (spec) => {
  const transformer = new CartesianChartSpecTransformer({
    type: spec.type,
    seriesType: spec.type,
  });
  transformer.transformSpec(spec);
};

test('b422 Classic analysis chart shape reproduces the VChart axes failure', () => {
  const b422ModelSpec = {
    type: 'bar',
    data: [{ id: 'analysisModelData', values: [] }],
    xField: 'amount',
    yField: 'model',
    axes: {
      x: { title: { visible: true, text: '消费金额（USD）' } },
      y: { label: { style: { fontSize: 11 } } },
    },
  };

  expect(() => transformSpec(b422ModelSpec)).toThrow(
    'spec.axes.forEach is not a function',
  );
});

test('Classic analysis chart specs satisfy the VChart axes contract', () => {
  const rows = [
    { model_name: 'VISIBLE_MODEL', period: 1704067200, quota: 500000 },
  ];
  const translate = (value) => value;
  const specs = [
    buildAnalysisModelChartSpec(rows, translate, 500000),
    buildAnalysisTrendChartSpec(rows, translate, 500000),
  ];

  specs.forEach((spec) => {
    expect(Array.isArray(spec.axes)).toBe(true);
    expect(() => transformSpec(spec)).not.toThrow();
  });
});

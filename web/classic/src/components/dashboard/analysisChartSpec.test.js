/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { expect, test } from 'bun:test';
import { CartesianChartSpecTransformer } from '@visactor/vchart/cjs/chart/cartesian/cartesian-transformer.js';
import {
  buildAnalysisModelChartSpec,
  buildAnalysisTrendChartSpec,
  formatPeriod,
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

test('Classic analysis table period formatter is exported for panel rendering', () => {
  expect(formatPeriod(1704067200)).toContain('2024');
  expect(formatPeriod(0)).toBe('-');
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import VChart from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

const createSpec = (dimensionField: string, fieldDomain: string[], values: Record<string, unknown>[]) => ({
  type: 'common',
  region: [{ clip: true }],
  series: [
    {
      id: 'bar-series',
      type: 'bar',
      xField: [dimensionField, 'metric'],
      yField: 'value',
      seriesField: 'legend',
      data: {
        id: 'barData',
        fields: {
          metric: { type: 'ordinal' },
          value: { type: 'linear' },
          legend: {
            type: 'ordinal',
            domain: ['sales'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          [dimensionField]: {
            type: 'ordinal',
            domain: fieldDomain,
            sortIndex: 0,
            lockStatisticsByDomain: true
          }
        },
        values
      }
    }
  ],
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ]
});

const getBarSeries = (chart: VChart) => chart.getChart().getAllSeries()[0] as any;
const getBarMark = (chart: VChart) =>
  getBarSeries(chart)
    .getMarks()
    .find((mark: any) => mark.type === 'rect');

describe('updateSpec data fields', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let chart: VChart;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    dom.style.width = '500px';
    dom.style.height = '500px';
  });

  afterEach(() => {
    chart?.release();
    removeDom(container);
  });

  test('should replace inline series data fields when updateSpec changes dimension field', () => {
    const spec = createSpec(
      'brand',
      ['A', 'B'],
      [
        { brand: 'A', metric: 'sales', value: 10, legend: 'sales' },
        { brand: 'B', metric: 'sales', value: 20, legend: 'sales' }
      ]
    );
    const nextSpec = createSpec(
      'model',
      ['M1', 'M2'],
      [
        { model: 'M1', metric: 'sales', value: 30, legend: 'sales' },
        { model: 'M2', metric: 'sales', value: 40, legend: 'sales' }
      ]
    );

    chart = new VChart(spec, { dom, animation: false });
    chart.renderSync();
    expect(getBarMark(chart).getGraphics()).toHaveLength(2);

    chart.updateSpecSync(nextSpec);

    const barSeries = getBarSeries(chart);
    expect(Object.keys(barSeries.getRawData().getFields())).not.toContain('brand');
    expect(Object.keys(barSeries.getRawData().getFields())).toContain('model');
    expect(barSeries.getRawData().latestData).toHaveLength(2);
    expect(getBarMark(chart).getGraphics()).toHaveLength(2);
  });
});

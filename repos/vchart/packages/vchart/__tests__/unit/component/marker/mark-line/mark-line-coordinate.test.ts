import { default as VChart } from '../../../../../src';
import { cartesianCoordinateLayout } from '../../../../../src/component/marker/utils';
import { createDiv, removeDom } from '../../../../util/dom';

const createLinearAxisHelper = (initialDomain: [number, number], range: [number, number]) => {
  let domain = [...initialDomain];

  return {
    isContinuous: true,
    getScale: () => ({
      type: 'linear',
      domain: () => domain
    }),
    dataToPosition: (values: unknown[]) => {
      const value = Number(values[0]);
      const ratio = (value - domain[0]) / (domain[1] - domain[0]);
      return range[0] + ratio * (range[1] - range[0]);
    },
    setExtendDomain: (_key: string, value: number | undefined) => {
      if (value === undefined) {
        return;
      }
      domain = [Math.min(domain[0], value), Math.max(domain[1], value)];
    }
  };
};

const createCartesianSeries = () => {
  const xAxisHelper = createLinearAxisHelper([1, 4], [0, 300]);
  const yAxisHelper = createLinearAxisHelper([10, 80], [300, 0]);

  return {
    getRegion: () => ({
      getLayoutStartPoint: () => ({ x: 0, y: 0 }),
      getLayoutRect: () => ({ width: 300, height: 300 })
    }),
    getXAxisHelper: () => xAxisHelper,
    getYAxisHelper: () => yAxisHelper
  };
};

describe('markLine coordinate layout', () => {
  it('should layout all coordinate points with extended autoRange domain', () => {
    const relativeSeries = createCartesianSeries();
    const data = {
      latestData: [
        { x: '1', y: 50 },
        { x: '3', y: 120 }
      ]
    };

    const points = cartesianCoordinateLayout(data as any, relativeSeries as any, true, undefined);

    expect(points[0].y).toBeCloseTo(relativeSeries.getYAxisHelper().dataToPosition([50]));
    expect(points[1].y).toBeCloseTo(relativeSeries.getYAxisHelper().dataToPosition([120]));
  });

  it('should render markLine start y with final autoRange domain', () => {
    const container = createDiv();
    const dom = createDiv(container);
    const chart = new VChart(
      {
        type: 'line',
        data: {
          id: 'data2',
          values: [
            { x: 1, y: 80 },
            { x: 2, y: 40 },
            { x: 3, y: 10 },
            { x: 4, y: 20 }
          ]
        },
        xField: 'x',
        yField: 'y',
        markLine: [
          {
            coordinates: [
              {
                x: '1',
                y: 50
              },
              {
                x: '3',
                y: 120
              }
            ],
            autoRange: true
          }
        ]
      } as any,
      {
        dom,
        animation: false
      }
    );

    try {
      chart.renderSync();

      const chartModel = chart.getChart();
      const marker = chartModel?.getComponentsByKey('markLine')?.[0] as any;
      const series = chartModel?.getAllSeries()[0] as any;
      const startPoint = marker?._markerComponent?.attribute?.points?.[0];
      const expectedY = series.getYAxisHelper().dataToPosition([50]) + series.getRegion().getLayoutStartPoint().y;

      expect(startPoint.y).toBeCloseTo(expectedY);
    } finally {
      chart.release();
      removeDom(container);
    }
  });
});

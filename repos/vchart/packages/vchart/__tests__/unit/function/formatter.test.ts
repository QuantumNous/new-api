import { DataSet } from '@visactor/vdataset';
import { VChart } from '../../../src/vchart-all';
import { createCanvas, removeDom } from '../../util/dom';
import { initChartDataSet } from '../../util/context';
import type { IBarChartSpec } from '../../../src';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);

const data = [
  { y: 100, x: '0', type: 'A', value: 50 },
  { y: 200, x: '1', type: 'B', value: 75 },
  { y: 300, x: '2', type: 'C', value: 25 },
  { y: 150, x: '3', type: 'D', value: 100 }
];

describe('formatter calc function test', () => {
  let canvasDom: HTMLCanvasElement;

  beforeEach(() => {
    canvasDom = createCanvas();
    canvasDom.style.position = 'relative';
    canvasDom.style.width = '500px';
    canvasDom.style.height = '500px';
    canvasDom.width = 500;
    canvasDom.height = 500;
  });

  afterEach(() => {
    removeDom(canvasDom);
  });

  test('basic calc expressions', () => {
    const spec = {
      data: {
        id: 'barData',
        values: data
      },
      type: 'bar',
      xField: 'x',
      yField: 'y',
      label: {
        visible: true
      },
      animation: false
    };

    const chart = new VChart(spec as unknown as IBarChartSpec, {
      renderCanvas: canvasDom,
      onError: () => {},
      animation: false
    });

    chart.renderSync();

    // 验证 calc 功能是否正确应用
    const formatter = (chart as any)._chartPlugin?._plugins?.find((p: any) => p.type === 'formatterPlugin');
    expect(formatter).toBeDefined();

    // 测试基本的 calc 表达式
    expect(formatter._format(100, { value: 10000 }, '{value:calc(v/10000)}w')).toBe('1w');
    expect(formatter._format(1, { value: 1 }, '{value:calc(v+99)}')).toBe('100');
    expect(formatter._format(0.111, { value: 0.111 }, '{value:.2f}')).toBe('0.11');
  });
});

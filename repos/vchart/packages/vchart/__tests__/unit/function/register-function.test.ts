import { DataSet } from '@visactor/vdataset';
import { VChart } from '../../../src/vchart-all';
import { createCanvas, removeDom } from '../../util/dom';
import { initChartDataSet } from '../../util/context';
import type { IBarChartSpec } from '../../../src';

// 保证引入执行 Build-in
const dataSet = new DataSet();
initChartDataSet(dataSet);

const data = [
  { y: '757', x: '0', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '642', x: '1', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '635', x: '2', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '686', x: '3', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '602', x: '4', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '749', x: '5', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '859', x: '6', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '638', x: '7', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '872', x: '8', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '843', x: '9', y2: '0', type: 'A', type2: 'A', color: 'A' },
  { y: '636', x: '0', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '751', x: '1', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '754', x: '2', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '792', x: '3', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '657', x: '4', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '835', x: '5', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '696', x: '6', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '685', x: '7', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '893', x: '8', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '661', x: '9', y2: '0', type: 'B', type2: 'A', color: 'C' },
  { y: '646', x: '0', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '879', x: '1', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '680', x: '2', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '775', x: '3', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '749', x: '4', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '843', x: '5', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '691', x: '6', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '633', x: '7', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '832', x: '8', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '636', x: '9', y2: '0', type: 'A', type2: 'B', color: 'B' },
  { y: '669', x: '0', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '713', x: '1', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '706', x: '2', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '695', x: '3', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '855', x: '4', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '806', x: '5', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '721', x: '6', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '613', x: '7', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '748', x: '8', y2: '0', type: 'B', type2: 'B', color: 'D' },
  { y: '664', x: '9', y2: '0', type: 'B', type2: 'B', color: 'D' }
];
const spec = {
  data: {
    id: 'barData',
    values: data
  },
  type: 'bar',
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'color',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  },
  animation: false
};

const spec2 = {
  data: {
    id: 'barData2',
    values: data
  },
  type: 'bar',
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'color',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  },
  animation: false
};

const spec3 = {
  data: {
    id: 'barData3',
    values: data
  },
  type: 'bar',
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'color',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  label: {
    visible: true,
    style: {
      fill: 'labelColor'
    }
  },
  animation: false
};

function labelFormat(key: string) {
  return key + 'test';
}

function labelColor() {
  return 'red';
}

describe('register function test', () => {
  let canvasDom: HTMLCanvasElement;
  let chart: VChart;
  let chart2: VChart;
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

  test('global function register', () => {
    // 全局注册函数
    VChart.registerFunction('labelFormat', labelFormat);

    chart = new VChart(spec as unknown as IBarChartSpec, {
      renderCanvas: canvasDom,
      onError: () => {},
      animation: false
    });

    chart.renderSync();

    // sepc
    expect(VChart.getFunctionList()?.length).toBe(1);
    expect(VChart.getFunctionList()?.[0]).toBe('labelFormat');
    expect(VChart.getFunction('labelFormat')?.(2000)).toBe(2000 + 'test');

    // label上是否应用
    const labelItem: any = chart.getStage().getElementsByName('label')[0];
    expect(labelItem.children[0].attribute.text).toBe(data[0].y + 'test');

    // 注销函数
    VChart.unregisterFunction('labelFormat');

    // sepc
    expect(VChart.getFunctionList()?.length).toBe(0);
  });

  test('instance function register', () => {
    chart2 = new VChart(spec2 as unknown as IBarChartSpec, {
      renderCanvas: canvasDom,
      onError: () => {},
      animation: false
    });

    // 实例注册函数
    chart2.registerFunction('labelFormat', labelFormat);

    chart2.renderSync();

    // sepc
    expect(chart2.getFunctionList()?.length).toBe(1);
    expect(chart2.getFunctionList()?.[0]).toBe('labelFormat');
    expect(chart2.getFunction('labelFormat')?.(2000)).toBe(2000 + 'test');

    // label上是否应用
    const labelItem: any = chart2.getStage().getElementsByName('label')[0];
    expect(labelItem.children[0].attribute.text).toBe(data[0].y + 'test');

    // 注销函数
    chart2.unregisterFunction('labelFormat');

    // sepc
    expect(chart2.getFunctionList()?.length).toBe(0);
  });

  test('updateSpec with expression function', () => {
    VChart.registerFunction('labelColor', labelColor);
    chart2.updateSpecSync(spec3 as any);

    // sepc
    expect(chart2.getFunctionList()?.length).toBe(1);
    expect(chart2.getFunctionList()?.[0]).toBe('labelColor');
    expect(chart2.getFunction('labelColor')?.()).toBe('red');

    // label上是否应用
    const labelItem: any = chart2.getStage().getElementsByName('label')[0];
    expect(labelItem.children[0].attribute.fill).toBe('red');

    // 注销函数
    chart2.unregisterFunction('labelColor');

    // sepc
    expect(chart2.getFunctionList()?.length).toBe(0);
  });
});

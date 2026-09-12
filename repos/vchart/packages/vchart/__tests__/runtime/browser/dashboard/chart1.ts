import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const barData = [
  { type: 'Category A', value: 28 },
  { type: 'Category B', value: 55 },
  { type: 'Category C', value: 43 }
];

export function createChart1(domId: string, option: any) {
  const spec = {
    type: 'bar',
    data: { values: barData },
    padding: 5,
    autoFit: true,
    xField: 'type',
    yField: 'value',
    title: { visible: true, text: 'Chart 1: Bar' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

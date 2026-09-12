import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const pieData = [
  { item: 'Item 1', percent: 0.4 },
  { item: 'Item 2', percent: 0.3 },
  { item: 'Item 3', percent: 0.2 },
  { item: 'Item 4', percent: 0.1 }
];

export function createChart3(domId: string, option: any) {
  const spec = {
    type: 'pie',
    data: { values: pieData },
    padding: 5,
    autoFit: true,
    categoryField: 'item',
    valueField: 'percent',
    title: { visible: true, text: 'Chart 3: Pie' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

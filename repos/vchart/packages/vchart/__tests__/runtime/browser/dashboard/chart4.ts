import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const radarData = [
  { category: 10, value: 20, group: 0 },
  { category: 20, value: 25, group: 0 },
  { category: 30, value: 15, group: 0 },
  { category: 40, value: 10, group: 0 },
  { category: 10, value: 15, group: 1 },
  { category: 20, value: 20, group: 1 },
  { category: 30, value: 25, group: 1 },
  { category: 40, value: 30, group: 1 }
];

export function createChart4(domId: string, option: any) {
  const spec = {
    type: 'radar',
    data: { values: radarData },
    padding: 5,
    autoFit: true,
    categoryField: 'category',
    valueField: 'value',
    seriesField: 'group',
    title: { visible: true, text: 'Chart 4: Radar' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const roseData = [
  { type: 'Type A', value: 27 },
  { type: 'Type B', value: 25 },
  { type: 'Type C', value: 18 },
  { type: 'Type D', value: 15 }
];

export function createChart6(domId: string, option: any) {
  const spec = {
    type: 'rose',
    data: { values: roseData },
    padding: 5,
    autoFit: true,
    categoryField: 'type',
    valueField: 'value',
    seriesField: 'type',
    title: { visible: true, text: 'Chart 6: Rose' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

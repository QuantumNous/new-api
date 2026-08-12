import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const areaData = [
  { time: '2023-01', value: 100, type: 'A' },
  { time: '2023-02', value: 120, type: 'A' },
  { time: '2023-01', value: 80, type: 'B' },
  { time: '2023-02', value: 90, type: 'B' }
];

export function createChart5(domId: string, option: any) {
  const spec = {
    type: 'area',
    data: { values: areaData },
    padding: 5,
    autoFit: true,
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    stack: true,
    title: { visible: true, text: 'Chart 5: Area' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

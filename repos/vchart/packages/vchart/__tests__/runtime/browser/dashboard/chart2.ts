import { VChart } from '../../../../src/index'; // 调整 VChart 的导入路径

const lineData = [
  { x: 'Mon', y: 120 },
  { x: 'Tue', y: 200 },
  { x: 'Wed', y: 150 },
  { x: 'Thu', y: 80 },
  { x: 'Fri', y: 70 }
];

export function createChart2(domId: string, option: any) {
  const spec = {
    type: 'line',
    data: { values: lineData },
    padding: 5,
    autoFit: true,
    xField: 'x',
    yField: 'y',
    title: { visible: true, text: 'Chart 2: Line' }
  };
  new VChart(spec, { dom: domId, ...option }).renderAsync();
}

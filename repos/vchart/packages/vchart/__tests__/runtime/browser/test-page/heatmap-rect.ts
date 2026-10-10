import { default as VChart } from '../../../../src/index';

/**
 * 浏览器示例：热力图矩形单元非等宽高验证
 */
const run = async () => {
  const spec = {
    type: 'heatmap',
    width: 500,
    height: 400,
    xField: 'x',
    yField: 'y',
    valueField: 'v',
    animation: false,
    tooltip: { visible: true },
    data: {
      id: 'data',
      values: [
        { x: 'A', y: '1', v: 10 },
        { x: 'A', y: '2', v: 20 },
        { x: 'A', y: '3', v: 30 },
        { x: 'A', y: '4', v: 40 },
        { x: 'B', y: '1', v: 50 },
        { x: 'B', y: '2', v: 60 },
        { x: 'B', y: '3', v: 70 },
        { x: 'B', y: '4', v: 80 }
      ]
    }
  } as any;

  const vchart = new VChart(spec, { dom: 'chart' });
  await vchart.renderAsync();
  (window as any)['vchart'] = vchart;
};

run();

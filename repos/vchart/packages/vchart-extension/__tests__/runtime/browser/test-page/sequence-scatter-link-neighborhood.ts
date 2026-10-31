import { registerSequenceScatterLink } from '../../../../src';
import { VChart } from '@visactor/vchart';
import { getSeqScatterChartData, selectEdges } from './utils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/**
 * 展示分类任务的Demo
 */
const TASK_TYPE = 'neighborhood';

/**
 * 获取图表数据
 */
const { chartData, scope, label_color_dict } = getSeqScatterChartData(TASK_TYPE);

/**
 * 创建sequence-scatter的特有配置项
 */
const spec = {
  type: 'sequenceScatterLink',
  taskType: TASK_TYPE,
  labelColor: label_color_dict,
  scope: scope,
  data: chartData,
  xField: 'x',
  yField: 'y',

  infoLabel: {
    visible: true,
    style: {
      text: datum => {
        return 'iteration: ' + datum.iter;
      }
    }
  },
  player: {
    orient: 'bottom',
    auto: true,
    interval: 2000,
    duration: 2000
  }
};

const run = () => {
  registerSequenceScatterLink();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    onError: err => {
      console.error(err);
    }
  });

  /**
   * 注册鼠标悬浮事件，绘制该节点的邻接边
   */
  cs.on('pointerover', { id: 'scatter-series' }, (e: { datum: { x: number; y: number } }) => {
    const endpoints = selectEdges(spec.data, e.datum?.x, e.datum?.y);
    cs.updateDataSync('endpoints', endpoints);
  });
  cs.on('pointerout', { id: 'scatter-series' }, () => {
    cs.updateDataSync('endpoints', []);
  });

  console.time('renderTime');

  cs.renderSync();

  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();

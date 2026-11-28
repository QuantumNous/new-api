import { registerSequenceScatterLink } from '../../../../src';
import { VChart } from '@visactor/vchart';
import { getSeqScatterChartData } from './utils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/**
 * 展示分类任务的Demo
 */
const TASK_TYPE = 'classification';

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

  console.time('renderTime');

  cs.renderSync();

  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();

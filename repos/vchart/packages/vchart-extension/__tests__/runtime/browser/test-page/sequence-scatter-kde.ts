import { registerSequenceScatterKDE } from '../../../../src';
import { VChart } from '@visactor/vchart';
import trainingData1 from '../data/sequence-scatter/Training_process1/data.json';
import labelData from '../data/sequence-scatter/Training_process1/label.json';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import trainingData2 from '../data/sequence-scatter/Training_process2/data.json';
// import labelData from '../data/sequence-scatter/Training_process2/label.json';

const origianlData = trainingData1;
// const origianlData = trainingData2;
const chartData = {};
Object.keys(origianlData).forEach(iter => {
  chartData[iter] = [];
  origianlData[iter].projection.forEach((pos, index) => {
    chartData[iter].push({
      x: pos[0],
      y: pos[1],
      label: labelData.label_index[index]
    });
  });
});

const spec = {
  width: 600,
  height: 400,
  type: 'sequenceScatterKDE',
  data: chartData,
  xField: 'x',
  yField: 'y',
  seriesField: 'label',

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
  },
  animation: false
};

const run = () => {
  registerSequenceScatterKDE();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
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

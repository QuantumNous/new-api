import { registerSequenceScatterPixel } from '../../../../src';
import { VChart } from '@visactor/vchart';
import trainingData1 from '../data/sequence-scatter/Training_process1/data.json';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import trainingData2 from '../data/sequence-scatter/Training_process2/data.json';
// import bgimgData from '../data/sequence-scatter/Training_process1/bgimg_data.json';

const response = await fetch(
  'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter-bg-data/bgimg_data.json'
);
const bgimgData = await response.json();

const origianlData = trainingData1;
// const origianlData = trainingData2;
const bgData = {};
if (bgimgData) {
  // 假设每个帧对应一个300x300的RGB矩阵
  Object.keys(bgimgData).forEach(inter => {
    // 确保原始数据中有这一帧
    if (origianlData[inter]) {
      bgData[inter] = bgimgData[inter];
    }
  });
}
const chartData = {};
Object.keys(origianlData).forEach(inter => {
  chartData[inter] = [];
  origianlData[inter].projection.forEach(pos => {
    chartData[inter].push({
      x: pos[0],
      y: pos[1]
    });
  });
});
const spec = {
  type: 'sequenceScatter',
  data: chartData,
  xField: 'x',
  yField: 'y',

  backgroundColors: bgData,

  infoLabel: {
    visible: true,
    style: {
      text: datum => {
        return 'interation: ' + datum.inter;
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
  registerSequenceScatterPixel();
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

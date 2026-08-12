import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { dataWordCloudShape } from '../../../data/data-wordcloud-shape';
const run = () => {
  const spec = {
    type: 'wordCloud',
    width: 500,
    height: 500,
    padding: 20,
    data: [
      {
        name: 'data',
        values: dataWordCloudShape
      }
    ],
    // 本地图片: 引用相对路径image无法loader，待canopus修复。先使用localhost的引入方法
    maskShape: `${window.location.origin}/sources/shape.png`,
    colorList: ['#325AB4'],
    wordCloudShapeConfig: {
      fillingColorList: ['#5BB5BF', '#92C8C6']
    },
    nameField: 'challenge_name',
    valueField: 'sum_count',
    seriesField: 'challenge_name'
  };

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();

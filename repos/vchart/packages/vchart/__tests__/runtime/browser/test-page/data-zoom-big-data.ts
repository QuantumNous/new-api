import { isMobile } from 'react-device-detect';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';
import bigData from './data/datazoom-big-data.json';

const spec = {
  ...bigData,
  dataZoom: [
    {
      ...bigData.dataZoom[0],
      showDetail: true,
      // tolerance: 10,
      realTime: false,
      // backgroundChart: {
      //   area: {
      //     visible: false,
      //     style: {
      //       visible: false,
      //       fill: 'red'
      //     }
      //   },
      //   line: {
      //     visible: false,
      //     style: {
      //       visible: false
      //     }
      //   }
      // },
      selectedBackgroundChart: {
        area: {
          visible: false,
          style: {
            visible: false
          }
        },
        line: {
          visible: false,
          style: {
            visible: false
          }
        }
      }
      // realTime: false,
      // showDetail: true,
      // maxSpan: 0.05
      // filterMode: 'axis'
      // showDetail: true
      // showDetail: false
    }
  ]
  // data: [
  //     {
  //       id: bigData.data[0].id,
  //       values: bigData.data[0].values.slice(0, 10000)
  //     },
  //     {
  //       id: bigData.data[1].id,
  //       values: bigData.data[1].values.slice(0, 10000)
  //     },
  //     {
  //       id: bigData.data[2].id,
  //       values: bigData.data[2].values
  //     }
  //   ]
};

const run = () => {
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement
    // mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    // theme: 'dark'
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });

  window['vchart'] = cs;
  console.log(cs);
};
run();

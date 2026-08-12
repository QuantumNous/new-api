import { isMobile } from 'react-device-detect';
// eslint-disable-next-line no-duplicate-imports
import type { IImageCloudChartSpec } from '../../../../src/index';
import { registerImageCloudChart, default as VChart } from '../../../../src/index';

const res = await fetch('https://cdn.jsdelivr.net/gh/xiaoluoHe/Resources/images/dogs/files.json');
// const res = await fetch('http://localhost:3003/dogs/files.json');
const dogs = await res.json();

const spec: IImageCloudChartSpec = {
  type: 'imageCloud',
  data: {
    values: dogs.map((dog, index) => {
      return {
        ...dog,
        name: `name-${index}`,
        value: index
      };
    })
  },
  padding: 0,
  urlField: 'url',
  nameField: 'name',
  valueField: 'value',
  // maskShape: {
  //   type: 'text',
  //   text: 'V',
  //   fontWeight: 'bold',
  //   fill: 'blue'
  // },
  // maskShape: `http://localhost:3003/upload/visactor.png`,
  image: {
    padding: 4,
    style: {
      cornerRadius: 10
      // visible: (datum: any) => datum.cell === '5_4',
      // fillOpacity: datum => (datum.frequency > 1 ? 0.6 : 1),
      // stroke: 'green',
      // shadowBlur: 10
      // shadowColor: 'grey'
    },
    state: {
      hover: {
        scaleX: 1.5,
        scaleY: 1.5,
        zIndex: 100
      }
    }
  },
  ratio: 0.08,
  // imageSizeRange: [100, 200],
  imageSize: 100,
  // maskShape: `http://localhost:3003/heart-red.png`,
  imageMask: {
    // visible: true,
    // edgeBlur: 200
    // threshold: 0,
    // invert: true
  },
  layoutConfig: {
    // layoutMode: 'spiral'
    // spiralType: 'rectangular'
    // minFillingImageSize: 80
    // fillingTimes: 10

    layoutMode: 'grid'
    // rectAspectRatio: 4 / 3
    // cellType: 'circle'
    // cellType: 'hexagonal'
    // layoutMode: 'stack'
    // placement: 'masked'
  },
  animationAppear: {
    // preset: 'scaleIn'
    // preset: 'growIn'
    // preset: 'axialRotate',
    // image: {
    //   duration: 2000,
    //   delay: (datum: any, item: any, params: any) => {
    //     return datum.x;
    //   }
    // }
  },
  // animationNormal: {
  //   image: {
  //     custom: ScrollingAnimation,
  //     customParameters: {
  //       width: 1000,
  //       direction: 'left'
  //     }
  //   }
  // },
  background: '#2A3051'
  // animationEnter: {
  //   image: {
  //     duration: 1000,
  //     easing: 'sineInOut'
  //     // totalTime: 10000
  //   }
  // }
};

registerImageCloudChart();

const run = () => {
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    //theme: 'dark',
    // animation: false,
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');
  cs.on('click', console.log);

  cs.renderSync();
  console.timeEnd('renderTime');

  setTimeout(() => {}, 2000);

  window['vchart'] = cs;
  console.log(cs);
};
run();

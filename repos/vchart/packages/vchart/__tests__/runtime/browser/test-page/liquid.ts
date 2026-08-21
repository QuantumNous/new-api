import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
// import { registerLiquidChart } from '@visactor/vchart';
import { registerLiquidChart } from '../../../../src/index';
import { reverse } from 'dns';
registerLiquidChart();

const run = () => {
  const data1 = [
    { date: 'Day 1', workload: 7000 },
    { date: 'Day 2', workload: 1000 },
    { date: 'Day 3', workload: 6000 },
    { date: 'Day 4', workload: 4000 },
    { date: 'Day 5', workload: 8000 },
    { date: 'Day 6', workload: 3000 },
    { date: 'Day 7', workload: 9000 },
    { date: 'Day 8', workload: 2000 },
    { date: 'Day 9', workload: 5000 }
  ];

  const data2 = [
    { date: 'Day 1', workload: 1000 },
    { date: 'Day 2', workload: 2000 },
    { date: 'Day 3', workload: 3000 },
    { date: 'Day 4', workload: 4000 },
    { date: 'Day 5', workload: 5000 }
  ];

  const data3 = [
    { date: 'Day 0', workload: 3000 },
    { date: 'Day 1', workload: 4000 },
    { date: 'Day 2', workload: 5000 },
    { date: 'Day3', workload: 6000 },
    { date: 'Day4', workload: 7000 },
    { date: 'Day5', workload: 8000 },
    { date: 'Day 5', workload: 8000 },
    { date: 'Day 10', workload: 8000 }
  ];

  let maskShape = 'circle';
  const targetRatio = 0.8;
  maskShape = 'triangle';
  //  maskShape = 'drop'
  //  maskShape = 'circle'
  // maskShape = 'star'
  // maskShape = 'rect'
  // maskShape = 'square'
  // maskShape = 'diamond'

  const reverse = true;

  const getCenterX = context => {
    const { x } = context.getLiquidBackPosAndSize();
    return x;
  };
  const getRadius = context => {
    const {
      size: liquidBackSize,
      width: liquidBackWidth,
      height: liquidBackHeight
    } = context.getLiquidBackPosAndSize();
    if (maskShape === 'circle') {
      // ok

      return (Math.sqrt(1 - (targetRatio - 0.5) * (targetRatio - 0.5) * 4) * liquidBackSize) / 2;
    } else if (maskShape === 'rect') {
      // ok
      return liquidBackWidth / 2;
    } else if (maskShape === 'square') {
      //ok
      return liquidBackSize / 2;
    } else if (maskShape === 'diamond') {
      // ok
      return targetRatio <= 0.5 ? liquidBackHeight * targetRatio : liquidBackHeight * (1 - targetRatio);
    } else if (maskShape === 'triangle') {
      // ok
      const triangleHeight = liquidBackSize;
      return (triangleHeight * (spec.reverse ? targetRatio : 1 - targetRatio)) / 2;
    } else if (maskShape === 'star') {
      // 0k
      let range: number[] = [];
      if (spec.reverse) {
        range = [0.38, 0.615];
      } else {
        range = [0.385, 0.62];
      }
      const { size: liquidBackSize, startY } = context.getLiquidBackPosAndSize();

      if (targetRatio <= range[0] || targetRatio >= range[1]) {
        const width = (liquidBackSize / 2) * 0.956;
        const radius = width / Math.cos(Math.PI / 10);
        const remainY = (radius + radius * Math.cos(Math.PI / 5)) * (spec.reverse ? targetRatio : 1 - targetRatio);
        return remainY * Math.tan(Math.PI / 10);
      }
      const width = (liquidBackSize / 2) * 0.956;
      const radius = width / Math.cos(Math.PI / 10);
      // const bottomY = startY + (radius + radius * Math.cos(Math.PI / 5))
      const totalHeight = radius + radius * Math.cos(Math.PI / 5);
      const targetHeight = (spec.reverse ? 1 - targetRatio : targetRatio) * totalHeight;
      // console.log('totalHeight', totalHeight)
      // console.log('rangeHeight', totalHeight * 0.385)
      // console.log('targetHeight', targetHeight)
      // console.log('lineLen', (bottomY - targetHeight - totalHeight * 0.385) / Math.tan(Math.PI / 5))
      return (targetHeight - totalHeight * 0.24) / Math.tan(Math.PI / 5);
    } else if (maskShape === 'drop') {
      const range = 0.5;
      const circleCenter = 0.65;
      const height = liquidBackSize * 0.97;
      const width = height * 0.675;
      const radius = width / 2;
      // circle part
      const computeRatio = spec.reverse ? 1 - targetRatio : targetRatio;

      if (computeRatio >= range) {
        return Math.sqrt(Math.pow(radius, 2) - Math.pow(Math.abs(computeRatio - circleCenter) * height, 2));
      } // triangle part
      return computeRatio * height * 0.57 - 8;
    }
    return liquidBackWidth / 2;
  };

  const getY = context => {
    const offsetReverse = spec.reverse ? 1 : -1;
    const { y: liquidBackCenterY, size: liquidBackSize } = context.getLiquidBackPosAndSize();
    if (maskShape === 'star') {
      if (spec.reverse) {
        const width = (liquidBackSize / 2) * 0.956;
        const radius = width / Math.cos(Math.PI / 10);
        const endY = liquidBackCenterY - liquidBackSize / 2 + (radius + radius * Math.cos(Math.PI / 5));
        const startY = liquidBackCenterY - liquidBackSize / 2;
        return startY + targetRatio * (endY - startY);
      }
      const width = (liquidBackSize / 2) * 0.956;
      const radius = width / Math.cos(Math.PI / 10);
      const startY = liquidBackCenterY - liquidBackSize / 2 + (radius + radius * Math.cos(Math.PI / 5));
      const endY = liquidBackCenterY - liquidBackSize / 2;
      return startY + targetRatio * (endY - startY);
    } else if (maskShape === 'drop') {
      const { size: liquidBackSize, startY: liquidStartY } = context.getLiquidBackPosAndSize();
      let height;
      let startY;
      let endY;
      if (spec.reverse) {
        height = liquidBackSize * 0.97;
        startY = liquidBackSize * 0.017 + liquidStartY;
        endY = startY + height;
      } else {
        height = liquidBackSize * 0.97;

        endY = liquidBackSize * 0.017 + liquidStartY;
        startY = endY + height;
      }
      return startY + targetRatio * (endY - startY);
    }
    return liquidBackCenterY + offsetReverse * (targetRatio - 0.5) * liquidBackSize;
  };

  const spec = {
    type: 'liquid',
    valueField: 'value',
    width: 400,
    height: 400,
    data: {
      id: 'data2',
      values: [
        {
          value: 0.8
        }
      ]
    },
    outlineMargin: 10,
    outlinePadding: 20,
    reverse,
    // maskShape: 'rect',
    // maskShape: 'star',
    // maskShape: 'triangle',
    // maskShape: 'square',
    maskShape,
    indicator: {
      visible: true,
      trigger: 'select',
      title: {
        visible: true,
        style: {
          fontSize: 18,
          text: '进度'
        }
      },
      content: [
        {
          visible: true,
          style: {
            fontSize: 18,
            text: data => {
              if (data) {
                const value = data['value'];
                return value ? `${value}%` : null;
              }
              return 1234;
            }
          }
        }
      ]
    },
    // indicatorSmartInvert: false,
    liquidBackground: {
      style: {
        fill: 'red'
      }
    },
    //   liquidOutline: {
    //     style: {
    //       fill: 'blue'
    //     }
    //   },
    animationAppear: false,
    // animationAppear: {
    //   preset: 'grow',
    //   liquid: {
    //     duration: 2000,
    //     loop: false
    //   },
    //   liquidGroup: {
    //     duration: 2000,
    //     loop: false
    //   }
    // },
    aniamtionUpdate: {
      duration: 1000
    },
    region: [
      {
        style: {
          fill: 'white'
        }
      }
    ],
    // animationNormal: {
    //   loop: true,
    //   liquid: {
    //     channel: {
    //       wave: {
    //         from: 0,
    //         to: 1
    //       },
    //       height: {
    //         from: 0,
    //         to: (...p) => {
    //           return p[3].getLiquidHeight
    //         }
    //       },
    //       y: {
    //         from: (...p) => {
    //           const { y: liquidBackY, size: liquidBackSize } = p[3].getLiquidBackPosAndSize();
    //           return liquidBackY + liquidBackSize / 2;
    //         },
    //         to: (...p) => {
    //           return p[3].getLiquidPosY()
    //         }
    //       }
    //     }
    //   }

    // }
    liquid: {
      style: {
        fill: {
          gradient: 'linear',
          x0: 0,
          x1: 0,
          y0: 1,
          y1: 0,

          stops: [
            {
              offset: 0,
              color: 'rgba(0,110,255,0.2)'
              // color: 'red'
            },
            // {
            //     "offset": 0.5,
            //     // "color": "rgba(0,110,255,0.2)"
            //     // color: 'green'
            // },
            {
              offset: 1,
              color: 'rgb(0,110,255)'
            }
          ]
        }
      }
    },
    background: 'black',
    extensionMark: [
      {
        type: 'rule',
        style: {
          stroke: 'red',
          x: (datum, context) => {
            return getCenterX(context) - getRadius(context);
          },
          x1: (datum, context) => {
            return getCenterX(context) + getRadius(context);
          },
          y: (datum, context) => {
            return getY(context);
          },
          y1: (datum, context) => {
            return getY(context);
          }
        }
      },
      {
        type: 'symbol',
        style: {
          fill: 'red',
          size: 5,
          x: (datum, context) => {
            return getCenterX(context) - getRadius(context);
          },
          y: (datum, context) => {
            return getY(context);
          },
          symbolType: 'triangle',
          angle: 90
        }
      },
      {
        type: 'symbol',
        style: {
          fill: 'red',
          size: 5,
          x: (datum, context) => {
            return getCenterX(context) + getRadius(context);
          },
          y: (datum, context) => {
            return getY(context);
          },
          symbolType: 'triangle',
          angle: -90
        }
      },
      {
        type: 'text',
        style: {
          text: '目标值' + targetRatio * 100 + '%',
          fill: 'red',
          fontSize: 8,
          x: (datum, context) => {
            return getCenterX(context) + getRadius(context) + 10;
          },
          y: (datum, context) => {
            return getY(context);
          },
          textBaseline: 'middle',
          textAlign: 'left'
        }
      }
    ]
  };

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  setTimeout(() => {
    cs.updateSpec({
      ...spec,
      //     background: 'black',
      width: 200,
      height: 200,
      // maskShape: 'star',
      data: {
        id: 'data2',
        values: [
          {
            value: 0.4
          }
        ]
      }
      // liquidOutline: {
      //   style: {
      //     fill: 'blue'
      //   }
      // },
      // liquidBackground: {
      //   style: {
      //     fill: 'red'
      //   }
      // }
    });
  }, 5000);
  window['vchart'] = cs;
  console.log(cs);
};
run();

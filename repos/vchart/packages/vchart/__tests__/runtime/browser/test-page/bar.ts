import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const markLineAttr = {
    // animation: false,
    animationEnter: {
      type: 'clipIn',
      duration: 1000
    },
    animationUpdate: {
      type: 'clipIn',
      duration: 1000,
      delay: 100
    },
    endSymbol: {
      refX: -4,
      style: {
        size: 8
      }
    },
    line: {
      style: {
        lineDash: [0]
      }
    },
    area: {
      style: {
        fill: 'red',
        fillOpacity: 1
      },
      state: {
        hover: {
          fill: 'blue'
        }
      }
    }
  };
  const data = {
    id: '0',
    values: [
      {
        type: 'retirement',
        origin: 'France',
        age: 60
      },
      {
        type: 'retirement',
        origin: 'Luxembourg',
        age: 58
      },
      {
        type: 'retirement',
        origin: 'Belgium',
        age: 60
      },
      {
        type: 'retirement',
        origin: 'Spain',
        age: 62
      },
      {
        type: 'retirement',
        origin: 'Greece',
        age: 61
      },
      {
        type: 'retirement',
        origin: 'Italy',
        age: 62
      },
      {
        type: 'retirement',
        origin: 'Austria',
        age: 62
      },
      {
        type: 'retirement',
        origin: 'Slovakia',
        age: 59
      },
      {
        type: 'retirement',
        origin: 'Turkey',
        age: 61
      },
      {
        type: 'retirement',
        origin: 'UK',
        age: 62
      },
      {
        type: 'retirement',
        origin: 'Australia',
        age: 63
      },
      {
        type: 'retirement',
        origin: 'Ireland',
        age: 63
      },
      {
        type: 'retirement',
        origin: 'Finland',
        age: 63
      },
      {
        type: 'retirement',
        origin: 'Netherlands',
        age: 64
      },
      {
        type: 'retirement',
        origin: 'Germany',
        age: 63
      },
      {
        type: 'retirement',
        origin: 'Canada',
        age: 65
      },
      {
        type: 'retirement',
        origin: 'Slovenia',
        age: 62
      },
      {
        type: 'retirement',
        origin: 'Switzerland',
        age: 65
      },
      {
        type: 'retirement',
        origin: 'Denmark',
        age: 64
      },
      {
        type: 'retirement',
        origin: 'Poland',
        age: 61
      },
      {
        type: 'retirement',
        origin: 'Norway',
        age: 65
      },
      {
        type: 'retirement',
        origin: 'Israel',
        age: 66
      },
      {
        type: 'healthy expectancy',
        origin: 'France',
        age: 78
      },
      {
        type: 'healthy expectancy',
        origin: 'Luxembourg',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Belgium',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Spain',
        age: 78
      },
      {
        type: 'healthy expectancy',
        origin: 'Greece',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Italy',
        age: 78
      },
      {
        type: 'healthy expectancy',
        origin: 'Austria',
        age: 78
      },
      {
        type: 'healthy expectancy',
        origin: 'Slovakia',
        age: 75
      },
      {
        type: 'healthy expectancy',
        origin: 'Turkey',
        age: 76
      },
      {
        type: 'healthy expectancy',
        origin: 'UK',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Australia',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Ireland',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Finland',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Netherlands',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Germany',
        age: 76
      },
      {
        type: 'healthy expectancy',
        origin: 'Canada',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Slovenia',
        age: 76
      },
      {
        type: 'healthy expectancy',
        origin: 'Switzerland',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Denmark',
        age: 76
      },
      {
        type: 'healthy expectancy',
        origin: 'Poland',
        age: 75
      },
      {
        type: 'healthy expectancy',
        origin: 'Norway',
        age: 77
      },
      {
        type: 'healthy expectancy',
        origin: 'Israel',
        age: 78
      },
      {
        type: 'regular expectancy',
        origin: 'France',
        age: 83
      },
      {
        type: 'regular expectancy',
        origin: 'Luxembourg',
        age: 83
      },
      {
        type: 'regular expectancy',
        origin: 'Belgium',
        age: 83
      },
      {
        type: 'regular expectancy',
        origin: 'Spain',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Greece',
        age: 82
      },
      {
        type: 'regular expectancy',
        origin: 'Italy',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Austria',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Slovakia',
        age: 80
      },
      {
        type: 'regular expectancy',
        origin: 'Turkey',
        age: 81
      },
      {
        type: 'regular expectancy',
        origin: 'UK',
        age: 82
      },
      {
        type: 'regular expectancy',
        origin: 'Australia',
        age: 85
      },
      {
        type: 'regular expectancy',
        origin: 'Ireland',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Finland',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Netherlands',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Germany',
        age: 82
      },
      {
        type: 'regular expectancy',
        origin: 'Canada',
        age: 85
      },
      {
        type: 'regular expectancy',
        origin: 'Slovenia',
        age: 82
      },
      {
        type: 'regular expectancy',
        origin: 'Switzerland',
        age: 85
      },
      {
        type: 'regular expectancy',
        origin: 'Denmark',
        age: 82
      },
      {
        type: 'regular expectancy',
        origin: 'Poland',
        age: 80
      },
      {
        type: 'regular expectancy',
        origin: 'Norway',
        age: 84
      },
      {
        type: 'regular expectancy',
        origin: 'Israel',
        age: 84
      }
    ]
  };

  const spec = {
    type: 'radar',
    data,
    categoryField: 'origin',
    valueField: 'age',
    seriesField: 'type',
    outerRadius: 0.9,
    color: ['#d0a668', 'rgb(85,170,161)', 'rgb(138,112,208)'],
    axes: [
      {
        orient: 'angle',
        domainLine: { visible: true },

        // grid: { visible: true, alignWithLabel: false },
        label: {
          visible: true,
          inside: true,
          autoRotate: true
        },
        tick: {
          inside: true
        },
        grid: {
          visible: true,
          style: {
            lineDash: [0]
          },
          alternateColor: ['#F2F2F2', '#FFFFFF'],
          alignWithLabel: false // grid does not align with label
        }
      },
      {
        orient: 'radius',
        grid: { visible: true, smooth: true },
        zero: false,
        max: 100,
        label: {
          visible: true
          // inside: true,
          // autoRotate: true
        }
      }
    ],
    line: {
      visible: false
    },
    markLine: [
      // {
      //   autoRange: true,
      //     radius: 60,
      //     radius1: 80,
      //     // angle: 'France',
      //     // angle1: 'Poland',
      //     ...markLineAttr
      // },
      {
        radius: 58,
        radius1: 77,
        angle: 'Luxembourg',
        ...markLineAttr,
        animation: false
      },
      {
        radius: 60,
        radius1: 77,
        angle: 'Belgium',
        ...markLineAttr
      },
      {
        radius: 62,
        radius1: 78,
        angle: 'Spain',
        ...markLineAttr
      },
      {
        radius: 61,
        radius1: 77,
        angle: 'Greece',
        ...markLineAttr
      },
      {
        radius: 62,
        radius1: 78,
        angle: 'Italy',
        ...markLineAttr
      },
      {
        radius: 62,
        radius1: 78,
        angle: 'Austria',
        ...markLineAttr
      },
      {
        radius: 59,
        radius1: 75,
        angle: 'Slovakia',
        ...markLineAttr
      },
      {
        radius: 61,
        radius1: 76,
        angle: 'Turkey',
        ...markLineAttr
      },
      {
        radius: 62,
        radius1: 77,
        angle: 'UK',
        ...markLineAttr
      },
      {
        radius: 63,
        radius1: 77,
        angle: 'Australia',
        ...markLineAttr
      },
      {
        radius: 63,
        radius1: 77,
        angle: 'Ireland',
        ...markLineAttr
      },
      {
        radius: 63,
        radius1: 77,
        angle: 'Finland',
        ...markLineAttr
      },
      {
        radius: 64,
        radius1: 77,
        angle: 'Netherlands',
        ...markLineAttr
      },
      {
        radius: 63,
        radius1: 76,
        angle: 'Germany',
        ...markLineAttr
      },
      {
        radius: 65,
        radius1: 77,
        angle: 'Canada',
        ...markLineAttr
      },
      {
        radius: 62,
        radius1: 76,
        angle: 'Slovenia',
        ...markLineAttr
      },
      {
        radius: 65,
        radius1: 77,
        angle: 'Switzerland',
        ...markLineAttr
      },
      {
        radius: 64,
        radius1: 76,
        angle: 'Denmark',
        ...markLineAttr
      },
      {
        radius: 61,
        radius1: 75,
        angle: 'Poland',
        ...markLineAttr
      },
      {
        radius: 65,
        radius1: 77,
        angle: 'Norway',
        ...markLineAttr
      },
      {
        radius: 66,
        radius1: 78,
        angle: 'Israel',
        ...markLineAttr
      },
      {
        radius: 100,
        label: {
          text: 'Order by length of healthy retirement ->',
          position: 'arcOuterEnd'
        },
        line: {
          style: {
            stroke: 'rgb(85,170,161)',
            lineWidth: 2,
            lineDash: [0]
          }
        },
        endSymbol: {
          visible: false,
          style: {
            fill: 'rgb(85,170,161)'
          }
        }
      }
    ],
    title: {
      text: 'Countries with the longest healthy retirements',
      textStyle: {
        height: 50,
        lineWidth: 2,
        fill: '#333',
        fontSize: 20,
        fontFamily: 'Times New Roman'
      },
      subtextStyle: {
        character: [
          {
            text:
              // eslint-disable-next-line max-len
              'In the above, the yellow dots represent retirement age, the green dots represent healthy life expectancy, and the purple dots represent regular life expectancy. Starting at the top and going clockwise, countries are ordered by the difference between healthy life expectancy and retirement age.',
            fontFamily: 'Times New Roman',
            fontSize: 14,
            fill: '#333'
          }
        ]
      }
    },
    legends: {
      visible: true
    }
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

import { isMobile } from 'react-device-detect';
import type { IHistogramChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';

const run = () => {
  const histogtamChart1: IHistogramChartSpec = {
    type: 'histogram',
    xField: 'from',
    x2Field: 'to',
    yField: 'profit',
    seriesField: 'type',
    bar: {
      style: {
        stroke: 'white',
        lineWidth: 1
      }
    },
    barBackground: {
      visible: true,
      style: {
        visible: datum => datum.from === 32
      }
    },
    title: {
      text: 'Profit',
      textStyle: {
        align: 'center',
        height: 50,
        lineWidth: 3,
        fill: '#333',
        fontSize: 25,
        fontFamily: 'Times New Roman'
      }
    },
    tooltip: {
      visible: true,
      mark: {
        title: {
          key: 'title',
          value: 'profit'
        },
        content: [
          {
            key: datum => datum['from'] + '～' + datum['to'],
            value: datum => datum['profit']
          }
        ]
      }
    },
    data: [
      {
        name: 'data1',
        values: [
          {
            from: 0,
            to: 10,
            profit: 2,
            type: 'A'
          },
          {
            from: 10,
            to: 16,
            profit: 3,
            type: 'B'
          },
          {
            from: 16,
            to: 18,
            profit: 15,
            type: 'C'
          },
          {
            from: 18,
            to: 26,
            profit: 12,
            type: 'D'
          },
          {
            from: 26,
            to: 32,
            profit: 22,
            type: 'E'
          },
          {
            from: 32,
            to: 56,
            profit: 7,
            type: 'F'
          },
          {
            from: 56,
            to: 62,
            profit: 17,
            type: 'G'
          }
        ]
      }
    ],
    axes: [
      {
        orient: 'bottom',
        nice: false,
        tick: {
          visible: true
        }
      }
    ]
  };
  const cs1 = new VChart(histogtamChart1, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  cs1.renderAsync();
  window['vchart'] = cs1;

  const cs2 = new VChart(
    {
      color: ['#1ac7c2', '#ccf59a'],
      type: 'histogram',
      xField: 'people',
      yField: 'age0',
      y2Field: 'age1',
      seriesField: 'sex',
      direction: 'horizontal',
      legends: {},
      bar: {
        style: {
          stroke: 'white',
          lineWidth: 1
        }
      },
      barBackground: {
        visible: true,
        style: {
          visible: datum => datum.age0 === 60,
          lineWidth: 2
        }
      },
      title: {
        text: 'A trellis bar chart showing the US population distribution of age groups and gender in 2000.',
        textStyle: {
          height: 50,
          lineWidth: 2,
          fill: '#333',
          fontSize: 18,
          fontFamily: 'Times New Roman'
        }
      },
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'title',
            value: datum => datum['sex']
          },
          content: [
            {
              key: datum => datum['age0'] + '～' + datum['age1'],
              value: datum => datum['people']
            }
          ]
        }
      },
      data: [
        {
          name: 'data1',
          values: [
            {
              year: 2000,
              age0: 0,
              age1: 5,
              people: 9735380,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 5,
              age1: 10,
              people: 10552146,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 10,
              age1: 15,
              people: 10563233,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 15,
              age1: 20,
              people: 10237419,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 20,
              age1: 25,
              people: 9731315,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 25,
              age1: 30,
              people: 9659493,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 30,
              age1: 35,
              people: 10205879,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 35,
              age1: 40,
              people: 11475182,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 40,
              age1: 45,
              people: 11320252,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 45,
              age1: 50,
              people: 9925006,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 50,
              age1: 55,
              people: 8507934,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 55,
              age1: 60,
              people: 6459082,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 60,
              age1: 65,
              people: 5123399,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 65,
              age1: 70,
              people: 4453623,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 70,
              age1: 75,
              people: 3792145,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 75,
              age1: 80,
              people: 2912655,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 80,
              age1: 85,
              people: 1902638,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 85,
              age1: 90,
              people: 970357,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 90,
              age1: 95,
              people: 336303,
              sex: 'Female'
            },
            {
              year: 2000,
              age0: 0,
              age1: 5,
              people: 9310714,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 5,
              age1: 10,
              people: 10069564,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 10,
              age1: 15,
              people: 10022524,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 15,
              age1: 20,
              people: 9692669,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 20,
              age1: 25,
              people: 9324244,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 25,
              age1: 30,
              people: 9518507,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 30,
              age1: 35,
              people: 10119296,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 35,
              age1: 40,
              people: 11635647,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 40,
              age1: 45,
              people: 11488578,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 45,
              age1: 50,
              people: 10261253,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 50,
              age1: 55,
              people: 8911133,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 55,
              age1: 60,
              people: 6921268,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 60,
              age1: 65,
              people: 5668961,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 65,
              age1: 70,
              people: 4804784,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 70,
              age1: 75,
              people: 5184855,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 75,
              age1: 80,
              people: 4355644,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 80,
              age1: 85,
              people: 3221898,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 85,
              age1: 90,
              people: 1981156,
              sex: 'Male'
            },
            {
              year: 2000,
              age0: 90,
              age1: 95,
              people: 1064581,
              sex: 'Male'
            }
          ]
        }
      ]
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  cs2.renderAsync();
  window['vchart2'] = cs2;
};
run();

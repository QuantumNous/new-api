import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const cs1 = new VChart(
    {
      type: 'bar',
      data: [
        {
          id: 'event_analysis_stack',
          values: [
            {
              x: '0',
              y: 28,
              c: 0
            },
            {
              x: 0.5,
              y: 20,
              c: 1
            },
            {
              x: 1,
              y: 43,
              c: 0
            },
            {
              x: 1.5,
              y: 35,
              c: 1
            },
            {
              x: 2,
              y: 81,
              c: 0
            },
            {
              x: 2.5,
              y: 10,
              c: 1
            },
            {
              x: 3,
              y: 19,
              c: 0
            },
            {
              x: 3.5,
              y: 15,
              c: 1
            },
            {
              x: 4,
              y: 52,
              c: 0
            },
            {
              x: 4.5,
              y: 48,
              c: 1
            },
            {
              x: 5,
              y: 24,
              c: 0
            },
            {
              x: 5.5,
              y: 28,
              c: 1
            },
            {
              x: 6,
              y: 87,
              c: 0
            },
            {
              x: 6.5,
              y: 66,
              c: 1
            },
            {
              x: 7,
              y: 17,
              c: 0
            },
            {
              x: 7.5,
              y: 27,
              c: 1
            },
            {
              x: 8,
              y: 68,
              c: 0
            },
            {
              x: 8.5,
              y: 16,
              c: 1
            },
            {
              x: 9,
              y: 49,
              c: 0
            },
            {
              x: 9.5,
              y: 25,
              c: 1
            },
            {
              x: 10,
              y: 28,
              c: 0
            },
            {
              x: 10.5,
              y: 20,
              c: 1
            },
            {
              x: 11,
              y: 43,
              c: 0
            },
            {
              x: 11.5,
              y: 35,
              c: 1
            },
            {
              x: 12,
              y: 81,
              c: 0
            },
            {
              x: 12.5,
              y: 10,
              c: 1
            },
            {
              x: 13,
              y: 19,
              c: 0
            },
            {
              x: 13.5,
              y: 15,
              c: 1
            },
            {
              x: 14,
              y: 52,
              c: 0
            },
            {
              x: 14.5,
              y: 48,
              c: 1
            },
            {
              x: 15,
              y: 24,
              c: 0
            },
            {
              x: 15.5,
              y: 28,
              c: 1
            },
            {
              x: 16,
              y: 87,
              c: 0
            },
            {
              x: 16.5,
              y: 66,
              c: 1
            },
            {
              x: 17,
              y: 17,
              c: 0
            },
            {
              x: 17.5,
              y: 27,
              c: 1
            },
            {
              x: 18,
              y: 68,
              c: 0
            },
            {
              x: 18.5,
              y: 16,
              c: 1
            },
            {
              x: 19,
              y: 49,
              c: 0
            },
            {
              x: 19.5,
              y: 25,
              c: 1
            },
            {
              x: 20,
              y: 28,
              c: 0
            },
            {
              x: 20.5,
              y: 20,
              c: 1
            },
            {
              x: 21,
              y: 43,
              c: 0
            },
            {
              x: 21.5,
              y: 35,
              c: 1
            },
            {
              x: 22,
              y: 81,
              c: 0
            },
            {
              x: 22.5,
              y: 10,
              c: 1
            },
            {
              x: 23,
              y: 19,
              c: 0
            },
            {
              x: 23.5,
              y: 15,
              c: 1
            },
            {
              x: 24,
              y: 52,
              c: 0
            },
            {
              x: 24.5,
              y: 48,
              c: 1
            },
            {
              x: 25,
              y: 24,
              c: 0
            },
            {
              x: 25.5,
              y: 28,
              c: 1
            },
            {
              x: 26,
              y: 87,
              c: 0
            },
            {
              x: 26.5,
              y: 66,
              c: 1
            },
            {
              x: 27,
              y: 17,
              c: 0
            },
            {
              x: 27.5,
              y: 27,
              c: 1
            },
            {
              x: 28,
              y: 68,
              c: 0
            },
            {
              x: 28.5,
              y: 16,
              c: 1
            },
            {
              x: 29,
              y: 49,
              c: 0
            },
            {
              x: 29.5,
              y: 25,
              c: 1
            },
            {
              x: 30,
              y: 28,
              c: 0
            },
            {
              x: 30.5,
              y: 20,
              c: 1
            },
            {
              x: 31,
              y: 43,
              c: 0
            },
            {
              x: 31.5,
              y: 35,
              c: 1
            },
            {
              x: 32,
              y: 81,
              c: 0
            },
            {
              x: 32.5,
              y: 10,
              c: 1
            },
            {
              x: 33,
              y: 19,
              c: 0
            },
            {
              x: 33.5,
              y: 15,
              c: 1
            },
            {
              x: 34,
              y: 52,
              c: 0
            },
            {
              x: 34.5,
              y: 48,
              c: 1
            },
            {
              x: 35,
              y: 24,
              c: 0
            },
            {
              x: 35.5,
              y: 28,
              c: 1
            },
            {
              x: 36,
              y: 87,
              c: 0
            },
            {
              x: 36.5,
              y: 66,
              c: 1
            },
            {
              x: 37,
              y: 17,
              c: 0
            },
            {
              x: 37.5,
              y: 27,
              c: 1
            },
            {
              x: 38,
              y: 68,
              c: 0
            },
            {
              x: 38.5,
              y: 16,
              c: 1
            },
            {
              x: 39,
              y: 49,
              c: 0
            },
            {
              x: 39.5,
              y: 25,
              c: 1
            }
          ]
        }
      ],
      xField: 'x',
      yField: 'y',
      axes: [
        {
          orient: 'bottom',
          sampling: false,
          label: {
            minGap: 19,
            autoRotate: true,
            autoHide: true
          }
        }
      ]
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  cs1.renderAsync();

  const cs2 = new VChart(
    {
      type: 'bar',
      height: 200,
      // width: 100,
      // padding: 0,
      data: [
        {
          id: 'barData',
          values: [
            { month: 'Monday', sales: 22 },
            { month: 'Tuesday', sales: 13 },
            { month: 'Wednesday', sales: 25 },
            { month: 'Thursday', sales: 29 },
            { month: 'Friday', sales: 38 }
          ]
        }
      ],
      xField: 'month',
      yField: 'sales',
      axes: [
        {
          orient: 'bottom',
          sampling: false,
          label: {
            autoRotate: true,
            autoLimit: true,
            autoHide: true
          }
        },
        {
          orient: 'left',
          sampling: false,
          label: {
            autoRotate: true,
            autoLimit: true,
            autoHide: true,
            formatMethod: () => 'AAAAAAAAAAA',
            flush: true
          }
        }
      ]
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser',
      poptip: false
    }
  );
  cs2.renderAsync();

  const cs3 = new VChart(
    {
      type: 'bar',
      height: 200,
      data: [
        {
          name: 'bar',
          fields: {
            y: {
              alias: '出售数量'
            }
          },
          values: [
            {
              x: '2021-12-21 2:00',
              y: 82
            },
            {
              x: '2021-12-21 4:00',
              y: 50
            },
            {
              x: '2021-12-21 6:00',
              y: 64
            },
            {
              x: '2021-12-21 8:00',
              y: 30
            },
            {
              x: '2021-12-21 10:00',
              y: 40
            },
            {
              x: '2021-12-21 12:00',
              y: 40
            },
            {
              x: '2021-12-21 14:00',
              y: 56
            },
            {
              x: '2021-12-21 16:00',
              y: 40
            },
            {
              x: '2021-12-21 18:00',
              y: 64
            },
            {
              x: '2021-12-21 20:00',
              y: 74
            },
            {
              x: '2021-12-21 22:00',
              y: 98
            }
          ]
        }
      ],
      xField: 'x',
      yField: 'y',
      axes: [
        {
          orient: 'bottom',
          sampling: false,
          label: {
            autoHide: true
          }
        }
      ]
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  cs3.renderAsync();

  const cs4 = new VChart(
    {
      type: 'line',
      axes: [
        {
          orient: 'left',
          label: {
            style: {
              fontSize: 10,
              fill: '#000000'
            },
            autoLimit: true,
            formatMethod: val => `+++++++++_${val}_+++++++++`
          }
        },
        {
          orient: 'bottom',
          label: {
            space: 4,
            style: {
              fontSize: 12,
              fill: '#000000'
            },
            autoLimit: true,
            autoHide: true,
            autoRotate: true,
            autoRotateAngle: [0, 30, 45],
            formatMethod: val => `+++++++++_${val}_+++++++++`
          }
        }
      ],
      data: [
        {
          id: 'line',
          fields: {
            y: {
              alias: '最高气温'
            }
          },
          values: [
            {
              x: '周一',
              y: 12
            },
            {
              x: '周二',
              y: 13
            },
            {
              x: '周三',
              y: 11
            },
            {
              x: '周四',
              y: 10
            },
            {
              x: '周五',
              y: 12
            },
            {
              x: '周六',
              y: 14
            },
            {
              x: '周日',
              y: 17
            }
          ]
        }
      ],
      xField: 'x',
      yField: 'y'
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  cs4.renderAsync();
};
run();

import { isMobile } from 'react-device-detect';
import { ILineChartSpec, IRadarChartSpec, default as VChart } from '../../../../src/index';

const run = () => {
  let base = +new Date(1988, 9, 3);
  const oneDay = 24 * 3600 * 1000;
  const data = [{ time: base, _value: `${0.8 * 10000}` }];
  for (let i = 1; i < 10000; i++) {
    const now = new Date((base += oneDay));
    data.push({
      time: +now,
      _value: `${(0.8 - 0.5) * 20 + Number(data[i - 1]._value)}`
    });
  }
  const spec: ILineChartSpec = {
    type: 'line',
    legends: {
      item: {
        label: {
          formatter: `分类：{label}`
        }
      }
    },
    data: [{ id: 'lineData', values: data }],
    xField: 'time',
    yField: '_value',
    axes: [
      {
        orient: 'bottom',
        type: 'time',
        layers: [
          {
            timeFormat: `%Y-%m-%d`
          }
        ]
      },
      {
        orient: 'left',
        label: {
          formatter: `{label:~s}`
        }
      }
    ],
    crosshair: {
      xField: {
        visible: true,
        defaultSelect: {
          axisIndex: 0,
          datum: base
        },
        label: {
          visible: true,
          // formatter: `{label:%Y}年{label:%m}月{label:%d}日`
          formatter: `{label:%Y : %m : %d}`
        }
      },
      yField: {
        visible: true,
        defaultSelect: {
          axisIndex: 1,
          datum: 4321
        },
        line: {
          style: {
            lineWidth: 1,
            opacity: 1,
            stroke: '#000',
            lineDash: [2, 2]
          }
        },
        label: {
          visible: true,
          formatter: `{label:.2s}`
        }
      }
    },

    tooltip: {
      dimension: {
        title: {
          valueFormatter: `{time:%Y-%m-%d}`
        },
        content: [
          {
            keyFormatter: `{time:%B %d,%Y}`,
            valueFormatter: `{_value:~s}`
          }
        ]
      }
    },
    dataZoom: [
      {
        orient: 'bottom',
        startText: { formatter: '开始时间：{label:%Y-%m-%d}' },
        endText: { formatter: '结束时间：{label:%Y-%m-%d}' }
      }
    ],
    markOverlap: true,
    label: { visible: true, formatter: `{_value:,.2f}` }
  };
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

  const specBug = {
    type: 'area',
    data: {
      values: [
        { type: 'Nail polish', country: 'Africa', value: 4229 },
        { type: 'Nail polish', country: 'EU', value: 4376 },
        { type: 'Nail polish', country: 'China', value: 3054 },
        { type: 'Nail polish', country: 'USA', value: 12814 },
        { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
        { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
        { type: 'Eyebrow pencil', country: 'China', value: 5067 },
        { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
        { type: 'Rouge', country: 'Africa', value: 5221 },
        { type: 'Rouge', country: 'EU', value: 3574 },
        { type: 'Rouge', country: 'China', value: 7004 },
        { type: 'Rouge', country: 'USA', value: 11624 },
        { type: 'Lipstick', country: 'Africa', value: 9256 },
        { type: 'Lipstick', country: 'EU', value: 4376 },
        { type: 'Lipstick', country: 'China', value: 9054 },
        { type: 'Lipstick', country: 'USA', value: 8814 },
        { type: 'Eyeshadows', country: 'Africa', value: 3308 },
        { type: 'Eyeshadows', country: 'EU', value: 4572 },
        { type: 'Eyeshadows', country: 'China', value: 12043 },
        { type: 'Eyeshadows', country: 'USA', value: 12998 },
        { type: 'Eyeliner', country: 'Africa', value: 5432 },
        { type: 'Eyeliner', country: 'EU', value: 3417 },
        { type: 'Eyeliner', country: 'China', value: 15067 },
        { type: 'Eyeliner', country: 'USA', value: 12321 },
        { type: 'Foundation', country: 'Africa', value: 13701 },
        { type: 'Foundation', country: 'EU', value: 5231 },
        { type: 'Foundation', country: 'China', value: 10119 },
        { type: 'Foundation', country: 'USA', value: 10342 },
        { type: 'Lip gloss', country: 'Africa', value: 4008 },
        { type: 'Lip gloss', country: 'EU', value: 4572 },
        { type: 'Lip gloss', country: 'China', value: 12043 },
        { type: 'Lip gloss', country: 'USA', value: 22998 },
        { type: 'Mascara', country: 'Africa', value: 18712 },
        { type: 'Mascara', country: 'EU', value: 6134 },
        { type: 'Mascara', country: 'China', value: 10419 },
        { type: 'Mascara', country: 'USA', value: 11261 }
      ]
    },
    title: {
      visible: true,
      text: 'Stacked area chart of cosmetic products sales'
    },
    // stack: true,
    xField: 'type',
    yField: 'value',
    seriesField: 'country',
    legends: [{ visible: true, position: 'middle', orient: 'bottom', item: {} }],
    crosshair: {
      xField: { visible: true }
    },
    tooltip: {
      dimension: {
        title: {
          valueStyle: {
            fill: 'green'
          }
        },
        content: [
          {
            key: datum => datum['country'],
            value: datum => datum['value'],
            valueStyle: {
              fill: 'red',
              fontWeight: 'bold'
            }
          },
          {
            key: '第二行',
            value: datum => datum['value'],
            keyStyle: {
              fill: 'blue',
              fontWeight: 'bold'
            },
            valueStyle: {
              fontSize: 12,
              lineHeight: 21
            }
          }
        ],
        updateContent: prev => {
          prev[2].keyStyle = {
            fill: 'orange',
            fontWeight: 'bold'
          };
          prev[2].valueStyle = {
            fill: 'orange',
            fontWeight: 'bold'
          };
          return prev;
        }
      }
    }
  };

  const specRadar: IRadarChartSpec = {
    type: 'radar',
    data: [
      {
        id: 'radar',
        values: [
          { name: 'Openlane', value1: 160.2, value2: 66.9 },
          { name: 'Yearin', value1: 150.1, value2: 50.5 },
          { name: 'Goodsilron', value1: 120.7, value2: 32.3 },
          { name: 'Condax', value1: 89.4, value2: 74.5 },
          { name: 'Opentech', value1: 78.5, value2: 29.7 },
          { name: 'Golddex', value1: 77.6, value2: 102.2 },
          { name: 'Isdom', value1: 69.8, value2: 22.6 },
          { name: 'Plusstrip', value1: 63.6, value2: 45.3 },
          { name: 'Kinnamplus', value1: 59.7, value2: 12.8 },
          { name: 'Zumgoity', value1: 54.3, value2: 19.6 },
          { name: 'Stanredtax', value1: 52.9, value2: 96.3 },
          { name: 'Conecom', value1: 42.9, value2: 11.9 },
          { name: 'Zencorporation', value1: 40.9, value2: 16.8 },
          { name: 'Iselectrics', value1: 39.2, value2: 9.9 },
          { name: 'Treequote', value1: 36.6, value2: 36.9 },
          { name: 'Sumace', value1: 34.8, value2: 14.6 },
          { name: 'Lexiqvolax', value1: 32.1, value2: 35.6 },
          { name: 'Sunnamplex', value1: 31.8, value2: 5.9 },
          { name: 'Faxquote', value1: 29.3, value2: 14.7 },
          { name: 'Donware', value1: 23.0, value2: 2.8 },
          { name: 'Warephase', value1: 21.5, value2: 12.1 },
          { name: 'Donquadtech', value1: 19.7, value2: 10.8 },
          { name: 'Nam-zim', value1: 15.5, value2: 4.1 },
          { name: 'Y-corporation', value1: 14.2, value2: 11.3 }
        ],
        transforms: [
          {
            type: 'fold',
            options: {
              key: 'type',
              value: 'value',
              fields: ['value1', 'value2']
            }
          }
        ]
      }
    ],
    categoryField: 'name',
    valueField: 'value',
    seriesField: 'type',
    innerRadius: 0.3,
    outerRadius: 0.9,
    stack: true,
    area: {
      visible: true
    },
    point: {
      visible: false
    },
    axes: [
      {
        orient: 'angle',
        label: {
          formatter: `{label} ttt`
        },
        domainLine: {
          style: {
            lineDash: [2, 2]
          }
        },
        grid: {
          style: {
            lineDash: [2, 2]
          }
        },
        tick: {
          visible: false
        }
      },
      {
        orient: 'radius',
        grid: {
          smooth: true,
          style: {
            lineDash: [2, 2]
          }
        },
        label: {
          visible: true,
          inside: true,
          formatter: `{label:.1f}`
        }
      }
    ],
    crosshair: {
      categoryField: {
        visible: true,
        line: {
          style: {
            stroke: '#000',
            lineWidth: 1,
            opacity: 1,
            lineDash: [4, 4]
          }
        },
        label: {
          visible: true,
          formatter: `{label} ttt`
        }
      },
      valueField: {
        visible: true,
        line: {
          smooth: true,
          style: {
            stroke: '#000',
            lineWidth: 1,
            opacity: 1,
            lineDash: [4, 4]
          }
        },
        label: {
          visible: true,
          formatter: `{label:.3f}`
        }
      }
    },
    legends: {
      visible: true
    }
  };

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    animation: false,
    onError: null
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  window['VChart'] = VChart;
  console.log(cs);
};
run();

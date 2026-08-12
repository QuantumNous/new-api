import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const spec = {
    animation: false,
    theme: {
      background: 'rgba(0,0,0,0)'
    },
    type: 'radar',
    data: [
      {
        values: [
          {
            key: '不一样的数字',
            value: 1,
            valueStr: '1',
            color: '爱尔兰',
            originData: [
              '不一样的数字',
              {
                hierarchyAggregate: true,
                id: 1746484799080487,
                label: '爱尔兰',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '张三',
            value: 1,
            valueStr: '1',
            color: '中国大陆',
            originData: [
              '张三',
              {
                hierarchyAggregate: true,
                id: 1746484804999256,
                label: '中国大陆',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '王武',
            value: 1,
            valueStr: '1',
            color: '中国大陆',
            originData: [
              '王武',
              {
                hierarchyAggregate: true,
                id: 1746484804999256,
                label: '中国大陆',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '赵世',
            value: 1,
            valueStr: '1',
            color: '利比里亚',
            originData: [
              '赵世',
              {
                hierarchyAggregate: true,
                id: 1746484793140328,
                label: '利比里亚',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '赵六',
            value: 1,
            valueStr: '1',
            color: '中国大陆',
            originData: [
              '赵六',
              {
                hierarchyAggregate: true,
                id: 1746484804999256,
                label: '中国大陆',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '赵六',
            value: 1,
            valueStr: '1',
            color: '捷克',
            originData: [
              '赵六',
              {
                hierarchyAggregate: true,
                id: 1746484805022791,
                label: '捷克',
                regionLevel: '_country'
              },
              1
            ]
          },
          {
            key: '里斯',
            value: 1,
            valueStr: '1',
            color: '中国大陆',
            originData: [
              '里斯',
              {
                hierarchyAggregate: true,
                id: 1746484804999256,
                label: '中国大陆',
                regionLevel: '_country'
              },
              1
            ]
          }
        ]
      }
    ],
    padding: 0,
    categoryField: 'key',
    valueField: 'value',
    seriesField: 'color',
    innerRadius: 0,
    outerRadius: 0.8,
    label: {
      visible: true,
      smartInvert: {
        contrastRatiosThreshold: 2
      },
      style: {
        fontSize: 12,
        fontFamily: 'DIN Pro'
      }
    },
    color: ['#4e83fd', '#50cefb', '#935af6', '#fad355'],
    area: {
      visible: true,
      style: {
        fillOpacity: 0.2
      },
      state: {
        hover_reverse: {
          opacity: 0.5
        }
      }
    },
    point: {
      style: {
        shape: 'circle',
        size: 6,
        lineWidth: 2,
        fill: '#fff'
      },
      state: {
        dimension_hover: {
          fill: '#fff',
          size: 8,
          lineWidth: 2
        },
        hover: {
          size: 8,
          fill: '#fff',
          lineWidth: 2,
          outerBorder: {
            distance: 2,
            lineWidth: 3,
            strokeOpacity: 0.2
          }
        },
        legend_hover: {
          size: 8,
          fill: '#fff',
          lineWidth: 2
        }
      }
    },
    region: [
      {
        style: {
          cursor: 'pointer'
        }
      }
    ],
    axes: [
      {
        orient: 'radius',
        min: 0,
        label: {
          visible: true,
          style: {
            fontSize: 12
          }
        },
        grid: {
          smooth: false,
          style: {
            lineWidth: 1,
            lineDash: [0],
            stroke: '#E9E9EA'
          }
        }
      },
      {
        orient: 'angle',
        tick: {
          visible: false
        },
        domainLine: {
          visible: false
        },
        label: {
          space: 16,
          style: {
            fontSize: 12
          }
        },
        grid: {
          style: {
            lineDash: [0],
            stroke: '#E9E9EA'
          }
        }
      }
    ],
    legends: {
      visible: false,
      interactive: true,
      orient: 'bottom',
      position: 'start',
      padding: {
        top: 12
      },
      item: {
        spaceCol: 16,
        spaceRow: 4,
        padding: [0, 0, 0, 0],
        label: {
          space: 16,
          style: {
            fontSize: 12,
            fill: '#646A73'
          }
        },
        background: {
          visible: false
        },
        shape: {
          space: 4,
          style: {
            fillOpacity: 1,
            lineWidth: 0,
            symbolType:
              // eslint-disable-next-line max-len
              'M4.6 2.8C4.6 3.8 3.8 4.6 2.8 4.6H-2.6C-3.6 4.6-4.4 3.8-4.4 2.8V-2.6C-4.4-3.6-3.6-4.4-2.6-4.4H2.8C3.8-4.4 4.6-3.6 4.6-2.6V2.8Z',
            size: 10,
            cursor: 'pointer'
          },
          state: {}
        }
      },
      maxRow: 1,
      pager: {
        padding: 0,
        space: 0,
        animation: false,
        handler: {
          space: 4,
          preShape:
            // eslint-disable-next-line max-len
            'M -0.1855 0.0116 C -0.1981 0.0016 -0.1981 -0.0176 -0.1855 -0.0276 L 0.075 -0.237 C 0.0914 -0.2503 0.116 -0.2385 0.116 -0.2174 V 0.2014 C 0.116 0.2225 0.0914 0.2343 0.075 0.221 L -0.1855 0.0116 Z',
          nextShape:
            // eslint-disable-next-line max-len
            'M 0.1695 -0.0172 C 0.1821 -0.0071 0.1821 0.012 0.1695 0.0221 L -0.091 0.2315 C -0.1075 0.2447 -0.132 0.233 -0.132 0.2118 L -0.132 -0.2069 C -0.132 -0.2281 -0.1075 -0.2398 -0.091 -0.2265 L 0.1695 -0.0172 Z',
          style: {
            fill: '#8F959E',
            size: 7
          },
          state: {
            hover: {
              fill: '#336DF4'
            },
            disable: {
              fill: '#BBBFC4'
            }
          }
        },
        textStyle: {
          fill: '#8F959E',
          fontSize: 12,
          lineHeight: 20
        }
      }
    },
    tooltip: {
      className: 'apaas-chart-tooltip-wrapper',
      activeType: ['dimension'],
      visible: true,
      dimension: {
        title: {},
        content: {}
      },
      style: {
        spaceRow: 6,
        keyLabel: {
          lineHeight: 20,
          fontSize: 12,
          fontColor: '#646A73',
          textAlign: 'left'
        },
        valueLabel: {
          lineHeight: 20,
          fontSize: 12,
          fontColor: '#646A73'
        },
        titleLabel: {
          fontSize: 12,
          lineHeight: 20,
          fontWeight: 400,
          fontColor: '#1F2329'
        },
        panel: {
          padding: {
            top: 10,
            bottom: 10,
            left: 12,
            right: 12
          },
          border: {
            color: '#EFF0F1',
            width: 1,
            radius: 6
          },
          shadow: {
            x: 0,
            y: 4,
            blur: 16,
            spread: 4,
            color: '#1F232908'
          }
        },
        shape: {
          size: 8,
          spacing: 5
        }
      }
    }
  };

  const spec2 = {
    type: 'bar',
    data: [
      {
        id: 'barData',
        values: [
          { type: 'Autocracies', year: '1930', value: 129 },
          { type: 'Autocracies', year: '1940', value: 133 },
          { type: 'Autocracies', year: '1950', value: 130 },
          { type: 'Autocracies', year: '1960', value: 126 },
          { type: 'Autocracies', year: '1970', value: 117 },
          { type: 'Autocracies', year: '1980', value: 114 },
          { type: 'Autocracies', year: '1990', value: 111 },
          { type: 'Autocracies', year: '2000', value: 89 },
          { type: 'Autocracies', year: '2010', value: 80 },
          { type: 'Autocracies', year: '2018', value: 80 },
          { type: 'Autocracies', year: '2020', value: 72 },
          { type: 'Autocracies', year: '2022', value: 50 }
          // { type: 'Democracies', year: '1930', value: 22 },
          // { type: 'Democracies', year: '1940', value: 13 },
          // { type: 'Democracies', year: '1950', value: 25 },
          // { type: 'Democracies', year: '1960', value: 29 },
          // { type: 'Democracies', year: '1970', value: 38 },
          // { type: 'Democracies', year: '1980', value: 41 },
          // { type: 'Democracies', year: '1990', value: 57 },
          // { type: 'Democracies', year: '2000', value: 87 },
          // { type: 'Democracies', year: '2010', value: 98 },
          // { type: 'Democracies', year: '2018', value: 99 }
        ]
      }
    ],
    // xField: ['year', 'type'],
    xField: 'year',
    yField: 'value',
    // seriesField: 'type',
    seriesField: 'year',
    legends: {
      visible: true,
      orient: 'top',
      position: 'start'
    },
    label: {
      visible: true,
      position: 'inside',
      formatMethod: text => {
        return text + '123456778';
      },
      style: {
        stroke: 'red'
      },
      smartInvert: {
        outsideEnable: true,
        mode: 'lightness',
        strokeStrategy: 'similarBase'
      }
    },
    color: [
      '#2E62F1',
      '#4DC36A',
      '#FF8406',
      '#FFCC00',
      '#4F44CF',
      '#5AC8FA',
      '#003A8C',
      '#B08AE2',
      '#FF6341',
      '#98DD62',
      '#07A199',
      '#87DBDD'
    ]
  };

  const cs = new VChart(spec2, {
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

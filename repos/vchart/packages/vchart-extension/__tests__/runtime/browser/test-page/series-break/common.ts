import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const spec = {
  type: 'common',
  markLine: [
    {
      x: 42,
      label: {
        text: '理论最大平均值: 63.60',
        position: 'insideEndTop',
        refY: -80,
        refX: 15.9,
        labelBackground: {
          padding: 5,
          style: {
            stroke: '#6690F2',
            fillOpacity: 0
          }
        },
        style: {
          fill: '#6690F2'
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    },
    {
      x: 100,
      label: {
        text: '实际平均值: 51.55',
        position: 'insideEndTop',
        refY: 2,
        refX: -25.775,
        labelBackground: {
          padding: 5,
          style: {
            stroke: '#6690F2',
            fillOpacity: 0
          }
        },
        style: {
          fill: '#6690F2'
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    }
  ],
  data: [
    {
      id: 'barData',
      values: [
        {
          date: '1',
          group: '人均销售额',
          value: '2422.12'
        },
        {
          date: '2',
          group: '人均销售额',
          value: '522.27'
        },
        {
          date: '3',
          group: '人均销售额',
          value: '348.91'
        },
        {
          date: '4',
          group: '人均销售额',
          value: '261.99'
        },
        {
          date: '5',
          group: '人均销售额',
          value: '207.80'
        },
        {
          date: '6',
          group: '人均销售额',
          value: '170.22'
        },
        {
          date: '7',
          group: '人均销售额',
          value: '142.32'
        },
        {
          date: '8',
          group: '人均销售额',
          value: '120.66'
        },
        {
          date: '9',
          group: '人均销售额',
          value: '103.29'
        },
        {
          date: '10',
          group: '人均销售额',
          value: '89.05'
        },
        {
          date: '11',
          group: '人均销售额',
          value: '77.17'
        },
        {
          date: '12',
          group: '人均销售额',
          value: '67.10'
        },
        {
          date: '13',
          group: '人均销售额',
          value: '58.46'
        },
        {
          date: '14',
          group: '人均销售额',
          value: '50.98'
        },
        {
          date: '15',
          group: '人均销售额',
          value: '44.46'
        },
        {
          date: '16',
          group: '人均销售额',
          value: '38.75'
        },
        {
          date: '17',
          group: '人均销售额',
          value: '33.73'
        },
        {
          date: '18',
          group: '人均销售额',
          value: '29.30'
        },
        {
          date: '19',
          group: '人均销售额',
          value: '25.36'
        },
        {
          date: '20',
          group: '人均销售额',
          value: '21.88'
        },
        {
          date: '21',
          group: '人均销售额',
          value: '18.78'
        },
        {
          date: '22',
          group: '人均销售额',
          value: '16.04'
        },
        {
          date: '23',
          group: '人均销售额',
          value: '13.62'
        },
        {
          date: '24',
          group: '人均销售额',
          value: '11.49'
        },
        {
          date: '25',
          group: '人均销售额',
          value: '9.62'
        },
        {
          date: '26',
          group: '人均销售额',
          value: '8.00'
        },
        {
          date: '27',
          group: '人均销售额',
          value: '6.59'
        },
        {
          date: '28',
          group: '人均销售额',
          value: '5.38'
        },
        {
          date: '29',
          group: '人均销售额',
          value: '4.34'
        },
        {
          date: '30',
          group: '人均销售额',
          value: '3.46'
        },
        {
          date: '31',
          group: '人均销售额',
          value: '2.72'
        },
        {
          date: '32',
          group: '人均销售额',
          value: '2.11'
        },
        {
          date: '33',
          group: '人均销售额',
          value: '1.60'
        },
        {
          date: '34',
          group: '人均销售额',
          value: '1.19'
        },
        {
          date: '35',
          group: '人均销售额',
          value: '0.87'
        },
        {
          date: '36',
          group: '人均销售额',
          value: '0.61'
        },
        {
          date: '37',
          group: '人均销售额',
          value: '0.41'
        },
        {
          date: '38',
          group: '人均销售额',
          value: '0.26'
        },
        {
          date: '39',
          group: '人均销售额',
          value: '0.15'
        },
        {
          date: '40',
          group: '人均销售额',
          value: '0.08'
        },
        {
          date: '41',
          group: '人均销售额',
          value: '0.03'
        },
        {
          date: '42',
          group: '人均销售额',
          value: '0.00'
        },
        {
          date: '43',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '44',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '45',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '46',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '47',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '48',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '49',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '50',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '51',
          group: '人均销售额',
          value: '-0.01'
        },
        {
          date: '52',
          group: '人均销售额',
          value: '-0.02'
        },
        {
          date: '53',
          group: '人均销售额',
          value: '-0.02'
        },
        {
          date: '54',
          group: '人均销售额',
          value: '-0.03'
        },
        {
          date: '55',
          group: '人均销售额',
          value: '-0.03'
        },
        {
          date: '56',
          group: '人均销售额',
          value: '-0.04'
        },
        {
          date: '57',
          group: '人均销售额',
          value: '-0.05'
        },
        {
          date: '58',
          group: '人均销售额',
          value: '-0.07'
        },
        {
          date: '59',
          group: '人均销售额',
          value: '-0.09'
        },
        {
          date: '60',
          group: '人均销售额',
          value: '-0.12'
        },
        {
          date: '61',
          group: '人均销售额',
          value: '-0.16'
        },
        {
          date: '62',
          group: '人均销售额',
          value: '-0.21'
        },
        {
          date: '63',
          group: '人均销售额',
          value: '-0.28'
        },
        {
          date: '64',
          group: '人均销售额',
          value: '-0.38'
        },
        {
          date: '65',
          group: '人均销售额',
          value: '-0.53'
        },
        {
          date: '66',
          group: '人均销售额',
          value: '-0.73'
        },
        {
          date: '67',
          group: '人均销售额',
          value: '-1.01'
        },
        {
          date: '68',
          group: '人均销售额',
          value: '-1.39'
        },
        {
          date: '69',
          group: '人均销售额',
          value: '-1.87'
        },
        {
          date: '70',
          group: '人均销售额',
          value: '-2.50'
        },
        {
          date: '71',
          group: '人均销售额',
          value: '-3.16'
        },
        {
          date: '72',
          group: '人均销售额',
          value: '-3.84'
        },
        {
          date: '73',
          group: '人均销售额',
          value: '-4.49'
        },
        {
          date: '74',
          group: '人均销售额',
          value: '-5.03'
        },
        {
          date: '75',
          group: '人均销售额',
          value: '-5.67'
        },
        {
          date: '76',
          group: '人均销售额',
          value: '-6.51'
        },
        {
          date: '77',
          group: '人均销售额',
          value: '-7.59'
        },
        {
          date: '78',
          group: '人均销售额',
          value: '-8.91'
        },
        {
          date: '79',
          group: '人均销售额',
          value: '-10.36'
        },
        {
          date: '80',
          group: '人均销售额',
          value: '-12.06'
        },
        {
          date: '81',
          group: '人均销售额',
          value: '-13.82'
        },
        {
          date: '82',
          group: '人均销售额',
          value: '-15.27'
        },
        {
          date: '83',
          group: '人均销售额',
          value: '-16.68'
        },
        {
          date: '84',
          group: '人均销售额',
          value: '-18.43'
        },
        {
          date: '85',
          group: '人均销售额',
          value: '-20.28'
        },
        {
          date: '86',
          group: '人均销售额',
          value: '-21.88'
        },
        {
          date: '87',
          group: '人均销售额',
          value: '-23.12'
        },
        {
          date: '88',
          group: '人均销售额',
          value: '-24.23'
        },
        {
          date: '89',
          group: '人均销售额',
          value: '-25.23'
        },
        {
          date: '90',
          group: '人均销售额',
          value: '-26.11'
        },
        {
          date: '91',
          group: '人均销售额',
          value: '-27.13'
        },
        {
          date: '92',
          group: '人均销售额',
          value: '-28.21'
        },
        {
          date: '93',
          group: '人均销售额',
          value: '-29.36'
        },
        {
          date: '94',
          group: '人均销售额',
          value: '-30.46'
        },
        {
          date: '95',
          group: '人均销售额',
          value: '-31.43'
        },
        {
          date: '96',
          group: '人均销售额',
          value: '-32.57'
        },
        {
          date: '97',
          group: '人均销售额',
          value: '-34.33'
        },
        {
          date: '98',
          group: '人均销售额',
          value: '-37.62'
        },
        {
          date: '99',
          group: '人均销售额',
          value: '-43.79'
        },
        {
          date: '100',
          group: '人均销售额',
          value: '-359.56'
        }
      ]
    },
    {
      id: 'id1',
      values: [
        {
          date: '1',
          group: '分布',
          value1: '31.17'
        },
        {
          date: '2',
          group: '分布',
          value1: '37.89'
        },
        {
          date: '3',
          group: '分布',
          value1: '42.37'
        },
        {
          date: '4',
          group: '分布',
          value1: '45.75'
        },
        {
          date: '5',
          group: '分布',
          value1: '48.42'
        },
        {
          date: '6',
          group: '分布',
          value1: '50.61'
        },
        {
          date: '7',
          group: '分布',
          value1: '52.44'
        },
        {
          date: '8',
          group: '分布',
          value1: '53.99'
        },
        {
          date: '9',
          group: '分布',
          value1: '55.32'
        },
        {
          date: '10',
          group: '分布',
          value1: '56.47'
        },
        {
          date: '11',
          group: '分布',
          value1: '57.46'
        },
        {
          date: '12',
          group: '分布',
          value1: '58.32'
        },
        {
          date: '13',
          group: '分布',
          value1: '59.08'
        },
        {
          date: '14',
          group: '分布',
          value1: '59.73'
        },
        {
          date: '15',
          group: '分布',
          value1: '60.30'
        },
        {
          date: '16',
          group: '分布',
          value1: '60.80'
        },
        {
          date: '17',
          group: '分布',
          value1: '61.24'
        },
        {
          date: '18',
          group: '分布',
          value1: '61.61'
        },
        {
          date: '19',
          group: '分布',
          value1: '61.94'
        },
        {
          date: '20',
          group: '分布',
          value1: '62.22'
        },
        {
          date: '21',
          group: '分布',
          value1: '62.46'
        },
        {
          date: '22',
          group: '分布',
          value1: '62.67'
        },
        {
          date: '23',
          group: '分布',
          value1: '62.85'
        },
        {
          date: '24',
          group: '分布',
          value1: '62.99'
        },
        {
          date: '25',
          group: '分布',
          value1: '63.12'
        },
        {
          date: '26',
          group: '分布',
          value1: '63.22'
        },
        {
          date: '27',
          group: '分布',
          value1: '63.30'
        },
        {
          date: '28',
          group: '分布',
          value1: '63.37'
        },
        {
          date: '29',
          group: '分布',
          value1: '63.43'
        },
        {
          date: '30',
          group: '分布',
          value1: '63.47'
        },
        {
          date: '31',
          group: '分布',
          value1: '63.51'
        },
        {
          date: '32',
          group: '分布',
          value1: '63.54'
        },
        {
          date: '33',
          group: '分布',
          value1: '63.56'
        },
        {
          date: '34',
          group: '分布',
          value1: '63.57'
        },
        {
          date: '35',
          group: '分布',
          value1: '63.58'
        },
        {
          date: '36',
          group: '分布',
          value1: '63.59'
        },
        {
          date: '37',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '38',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '39',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '40',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '41',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '42',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '43',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '44',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '45',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '46',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '47',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '48',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '49',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '50',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '51',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '52',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '53',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '54',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '55',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '56',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '57',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '58',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '59',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '60',
          group: '分布',
          value1: '63.60'
        },
        {
          date: '61',
          group: '分布',
          value1: '63.59'
        },
        {
          date: '62',
          group: '分布',
          value1: '63.59'
        },
        {
          date: '63',
          group: '分布',
          value1: '63.59'
        },
        {
          date: '64',
          group: '分布',
          value1: '63.58'
        },
        {
          date: '65',
          group: '分布',
          value1: '63.58'
        },
        {
          date: '66',
          group: '分布',
          value1: '63.57'
        },
        {
          date: '67',
          group: '分布',
          value1: '63.55'
        },
        {
          date: '68',
          group: '分布',
          value1: '63.54'
        },
        {
          date: '69',
          group: '分布',
          value1: '63.51'
        },
        {
          date: '70',
          group: '分布',
          value1: '63.48'
        },
        {
          date: '71',
          group: '分布',
          value1: '63.44'
        },
        {
          date: '72',
          group: '分布',
          value1: '63.39'
        },
        {
          date: '73',
          group: '分布',
          value1: '63.33'
        },
        {
          date: '74',
          group: '分布',
          value1: '63.27'
        },
        {
          date: '75',
          group: '分布',
          value1: '63.19'
        },
        {
          date: '76',
          group: '分布',
          value1: '63.11'
        },
        {
          date: '77',
          group: '分布',
          value1: '63.01'
        },
        {
          date: '78',
          group: '分布',
          value1: '62.90'
        },
        {
          date: '79',
          group: '分布',
          value1: '62.76'
        },
        {
          date: '80',
          group: '分布',
          value1: '62.61'
        },
        {
          date: '81',
          group: '分布',
          value1: '62.43'
        },
        {
          date: '82',
          group: '分布',
          value1: '62.24'
        },
        {
          date: '83',
          group: '分布',
          value1: '62.02'
        },
        {
          date: '84',
          group: '分布',
          value1: '61.78'
        },
        {
          date: '85',
          group: '分布',
          value1: '61.52'
        },
        {
          date: '86',
          group: '分布',
          value1: '61.24'
        },
        {
          date: '87',
          group: '分布',
          value1: '60.94'
        },
        {
          date: '88',
          group: '分布',
          value1: '60.63'
        },
        {
          date: '89',
          group: '分布',
          value1: '60.31'
        },
        {
          date: '90',
          group: '分布',
          value1: '59.97'
        },
        {
          date: '91',
          group: '分布',
          value1: '59.62'
        },
        {
          date: '92',
          group: '分布',
          value1: '59.26'
        },
        {
          date: '93',
          group: '分布',
          value1: '58.88'
        },
        {
          date: '94',
          group: '分布',
          value1: '58.49'
        },
        {
          date: '95',
          group: '分布',
          value1: '58.08'
        },
        {
          date: '96',
          group: '分布',
          value1: '57.67'
        },
        {
          date: '97',
          group: '分布',
          value1: '57.22'
        },
        {
          date: '98',
          group: '分布',
          value1: '56.74'
        },
        {
          date: '99',
          group: '分布',
          value1: '56.18'
        },
        {
          date: '100',
          group: '分布',
          value1: '51.55'
        }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      xField: 'date',
      yField: 'value',
      seriesField: 'group',
      seriesId: ['bar'],
      stack: true,
      bar: {
        style: {
          lineDash: [3, 3],
          stroke: 'black',
          lineWidth: 1
        }
      },
      extensionMark: [
        {
          type: 'line',
          visible: true,
          style: {
            x: 0,
            size: 12,
            fill: 'white',
            stroke: 'grey',
            lineWidth: 1
          }
        },
        {
          type: 'text',
          visible: true,
          style: {
            textBaseline: 'middle',
            background: 'white',
            fill: '#666'
          }
        },
        {
          type: 'text',
          visible: true,
          style: {
            textBaseline: 'middle',
            background: 'white',
            fill: '#666'
          }
        }
      ],
      max: 2543.2288230215304
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      xField: 'date',
      yField: 'value1',
      seriesField: 'group',
      point: false,
      line: {
        style: {
          curveType: 'monotone'
        }
      }
    }
  ],
  axes: [
    {
      id: 'leftYAxis',
      orient: 'left',
      label: {},
      grid: {
        visible: false
      },
      seriesId: ['bar'],
      unit: {
        visible: true,
        text: '人均销售额(元)',
        style: {
          fill: 'black',
          dx: -12,
          dy: -16
        }
      },
      nice: false,
      tick: {
        tickMode: 'd3'
      },
      domainLine: {
        visible: true
      },
      breaks: [
        {
          scopeType: 'length',

          range: [626.7279485070644, 2317.668030507423],
          breakSymbol: {
            style: {
              stroke: 'black',
              fill: 'white',
              size: 15
            }
          }
        }
      ]
    },
    {
      orient: 'right',
      sync: {
        axisId: 'leftYAxis',
        zeroAlign: true
      },
      label: {},
      seriesId: ['line'],
      grid: {
        visible: false
      },
      domainLine: {
        visible: true
      },
      unit: {
        visible: true,
        text: '分布(亿)',
        style: {
          fill: 'black',
          dx: 12,
          dy: -16
        }
      }
    },
    {
      orient: 'bottom',
      visible: false,
      bandPadding: 0,
      domainLine: {
        onZero: true
      }
    }
  ],
  legends: {
    visible: false
  },
  customMark: []
};

const run = () => {
  registerSeriesBreak();
  appendSeriesBreakConfig(spec as IBarChartSpec);

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();

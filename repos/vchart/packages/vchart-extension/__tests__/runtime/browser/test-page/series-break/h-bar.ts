import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const spec = {
  direction: 'horizontal',
  type: 'common',
  // color: ['#00295C', '#2568BD', '#9F9F9F', '#C5C5C5', '#00B0F0', '#4BCFFF', '#C2C2C2', '#D7D7D7'],
  series: [
    {
      type: 'bar',
      stack: true,
      direction: 'horizontal',
      bar: {
        style: {
          stroke: '',
          lineWidth: 1
        },
        state: {
          hover: {
            stroke: '#000',
            lineWidth: 1
          }
        }
      },
      barBackground: {
        style: {
          stroke: '',
          lineWidth: 1
        }
      },
      label: {
        visible: true,
        position: 'outside',
        style: {
          lineHeight: '100%',
          fontSize: 16,
          fontWeight: 'bold'
        },
        overlap: {
          strategy: []
        },
        smartInvert: true,
        formatConfig: {},
        interactive: true
      },
      totalLabel: {
        visible: true,
        position: 'top',
        overlap: false,
        clampForce: false,
        formatConfig: {
          fixed: 0,
          content: 'value'
        },
        style: {
          lineHeight: '100%',
          lineWidth: 1,
          fill: '#1F2329',
          stroke: '#ffffff',
          fontSize: 16,
          fontWeight: 'bold'
        },
        interactive: true
      },
      seriesLabel: {
        visible: true,
        position: 'start',
        label: {
          style: {
            lineHeight: '100%',
            lineWidth: 1,
            stroke: '#ffffff',
            fontSize: 16,
            fontWeight: 'bold'
          },
          space: 10
        }
      },
      xField: '_editor_value_field',
      yField: '_editor_dimension_field',
      dataId: '0',
      id: 'series-0',
      EDITOR_SERIES_DATA_KEY: 'visits',
      seriesField: '_editor_type_field'
    }
  ],
  legends: {
    id: 'legend-discrete',
    visible: false,
    autoPage: false,
    position: 'start',
    interactive: false,
    item: {
      label: {
        style: {
          fill: '#1F2329',
          fontSize: 16
        }
      }
    }
  },
  region: [
    {
      id: 'region-0'
    }
  ],
  tooltip: {
    visible: true,
    mark: {
      content: [{}],
      title: {}
    },
    dimension: {
      content: [{}],
      title: {}
    }
  },
  axes: [
    {
      orient: 'left',
      id: 'axis-left',
      type: 'band',
      trimPadding: false,
      label: {
        autoLimit: false,
        style: {
          fill: '#1F2329',
          fontSize: 16
        },
        formatConfig: {}
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000000'
        },
        onZero: true
      },
      tick: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      grid: {
        visible: false,
        style: {
          stroke: '#bbbfc4'
        }
      },
      autoIndent: false,
      maxWidth: null,
      maxHeight: null
    },
    {
      orient: 'bottom',
      id: 'axis-bottom',
      type: 'linear',
      label: {
        autoLimit: false,
        style: {
          fill: '#1F2329',
          fontSize: 16
        },
        formatConfig: {}
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      tick: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      grid: {
        visible: false,
        style: {
          stroke: '#bbbfc4'
        }
      },
      autoIndent: false,
      maxWidth: null,
      maxHeight: null,
      breaks: [
        {
          scopeType: 'length',
          range: [2000, 23000],
          gap: 5,
          breakSymbol: {
            visible: true,
            style: {
              size: 8,
              stroke: '#000',
              lineWidth: 1,
              pickable: false
            }
          }
        }
      ],
      zIndex: 550
    }
  ],
  data: [
    {
      id: '0',
      sourceKey: 'visits',
      values: [
        {
          _editor_dimension_field: 'USA',
          _editor_value_field: 23725,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'China',
          _editor_value_field: 1882,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Japan',
          _editor_value_field: 1809,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Germany',
          _editor_value_field: 1322,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'UK',
          _editor_value_field: 1122,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'France',
          _editor_value_field: 1114,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'India',
          _editor_value_field: 984,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Spain',
          _editor_value_field: 711,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Netherlands',
          _editor_value_field: 665,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Russia',
          _editor_value_field: 580,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'South Korea',
          _editor_value_field: 443,
          _editor_type_field: 'visits'
        },
        {
          _editor_dimension_field: 'Canada',
          _editor_value_field: 441,
          _editor_type_field: 'visits'
        }
      ],
      specField: {
        _editor_dimension_field: {
          type: 'dimension',
          order: 0
        },
        _editor_type_field: {
          type: 'series',
          order: 0
        },
        _editor_value_field: {
          type: 'value',
          order: 0
        }
      }
    }
  ],
  labelLayout: 'region',
  width: 640,
  height: 360,
  background: 'transparent'
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

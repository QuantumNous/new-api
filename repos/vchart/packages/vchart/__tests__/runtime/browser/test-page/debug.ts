import { default as VChart } from '../../../../src/index';
const CONTAINER_ID = 'chart';

const run = async () => {
  const spec = {
    direction: 'vertical',
    type: 'common',
    color: [
      '#D1E6FB',
      '#A3CDF7',
      '#76B4F3',
      '#489BEF',
      '#1A82EB',
      '#1568BC',
      '#104E8D',
      '#0A345E',
      '#051A2F',
      '#030D18'
    ],
    series: [
      {
        type: 'bar',
        stack: true,
        direction: 'vertical',
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
          position: 'inside',
          style: {
            lineHeight: '100%',
            fontSize: 16,
            fontWeight: 'bold',
            pickMode: 'imprecise'
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
            fontWeight: 'bold',
            pickMode: 'imprecise'
          },
          interactive: true,
          alwayCalculateTotal: true
        },
        seriesLabel: {
          visible: true,
          position: 'end',
          label: {
            style: {
              lineHeight: '100%',
              lineWidth: 1,
              stroke: '#ffffff',
              fontSize: 16,
              fontWeight: 'bold'
            },
            space: 10,
            formatConfig: {
              content: 'series'
            }
          }
        },
        xField: '_editor_dimension_field',
        yField: '_editor_value_field',
        dataId: '0',
        id: 'series-0',
        EDITOR_SERIES_DATA_KEY: '系列 1',
        seriesField: '_editor_type_field'
      },
      {
        type: 'bar',
        stack: true,
        direction: 'vertical',
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
          position: 'inside',
          style: {
            lineHeight: '100%',
            fontSize: 16,
            fontWeight: 'bold',
            pickMode: 'imprecise'
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
            fontWeight: 'bold',
            pickMode: 'imprecise'
          },
          interactive: true,
          alwayCalculateTotal: true
        },
        seriesLabel: {
          visible: true,
          position: 'end',
          label: {
            style: {
              lineHeight: '100%',
              lineWidth: 1,
              stroke: '#ffffff',
              fontSize: 16,
              fontWeight: 'bold'
            },
            space: 10,
            formatConfig: {
              content: 'series'
            }
          }
        },
        xField: '_editor_dimension_field',
        yField: '_editor_value_field',
        dataId: '1',
        id: 'series-1',
        EDITOR_SERIES_DATA_KEY: '系列 2',
        seriesField: '_editor_type_field'
      },
      {
        type: 'bar',
        stack: true,
        direction: 'vertical',
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
          position: 'inside',
          style: {
            lineHeight: '100%',
            fontSize: 16,
            fontWeight: 'bold',
            pickMode: 'imprecise'
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
            fontWeight: 'bold',
            pickMode: 'imprecise'
          },
          interactive: true,
          alwayCalculateTotal: true
        },
        seriesLabel: {
          visible: true,
          position: 'end',
          label: {
            style: {
              lineHeight: '100%',
              lineWidth: 1,
              stroke: '#ffffff',
              fontSize: 16,
              fontWeight: 'bold'
            },
            space: 10,
            formatConfig: {
              content: 'series'
            }
          }
        },
        xField: '_editor_dimension_field',
        yField: '_editor_value_field',
        dataId: '2',
        id: 'series-2',
        EDITOR_SERIES_DATA_KEY: '系列 3',
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
            fontSize: 16,
            lineWidth: 1
          }
        }
      },
      _originalVisible: false
    },
    region: [
      {
        id: 'region-0',
        stackInverse: true
      }
    ],
    tooltip: {
      visible: false,
      mark: {
        content: [{}],
        title: {}
      },
      dimension: {
        content: [{}],
        title: {}
      },
      enterable: true,
      showDelay: 0,
      style: {
        maxContentHeight: '95%'
      }
    },
    axes: [
      {
        orient: 'left',
        id: 'axis-left',
        type: 'linear',
        label: {
          autoLimit: false,
          autoHide: true,
          style: {
            fill: '#1F2329',
            fontSize: 16,
            lineWidth: 1
          },
          formatConfig: {},
          _originStyle: {
            fill: '#1F2329',
            fontSize: 16,
            lineWidth: 1
          }
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
        sampling: true,
        maxWidth: null,
        maxHeight: null
      },
      {
        orient: 'bottom',
        id: 'axis-bottom',
        type: 'band',
        label: {
          autoLimit: false,
          autoHide: true,
          style: {
            fill: '#1F2329',
            fontSize: 16,
            lineWidth: 1
          },
          formatConfig: {},
          _originStyle: {
            fill: '#1F2329',
            fontSize: 16,
            lineWidth: 1
          }
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
        sampling: true,
        maxWidth: null,
        maxHeight: null,
        trimPadding: false,
        paddingInner: [0.2, 0],
        paddingOuter: [0.2, 0]
      }
    ],
    data: [
      {
        id: '0',
        sourceKey: '系列 1',
        values: [
          {
            _editor_value_field: 10,
            _editor_type_field: '系列 1',
            _editor_dimension_field: '类别 A'
          },
          {
            _editor_value_field: 24,
            _editor_type_field: '系列 1',
            _editor_dimension_field: '类别 B'
          },
          {
            _editor_value_field: 40,
            _editor_type_field: '系列 1',
            _editor_dimension_field: '类别 C'
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
      },
      {
        id: '1',
        sourceKey: '系列 2',
        values: [
          {
            _editor_value_field: 15,
            _editor_type_field: '系列 2',
            _editor_dimension_field: '类别 A'
          },
          {
            _editor_value_field: 25,
            _editor_type_field: '系列 2',
            _editor_dimension_field: '类别 B'
          },
          {
            _editor_value_field: 28,
            _editor_type_field: '系列 2',
            _editor_dimension_field: '类别 C'
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
      },
      {
        id: '2',
        sourceKey: '系列 3',
        values: [
          {
            _editor_value_field: 20,
            _editor_type_field: '系列 3',
            _editor_dimension_field: '类别 A'
          },
          {
            _editor_value_field: 30,
            _editor_type_field: '系列 3',
            _editor_dimension_field: '类别 B'
          },
          {
            _editor_value_field: 35,
            _editor_type_field: '系列 3',
            _editor_dimension_field: '类别 C'
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
    markLine: [
      {
        _editor_marker_format_: false,
        _editor_marker_index: 0,
        _editor_marker_label_: '+129%',
        _originValue_: [45, 103],
        connectDirection: 'top',
        coordinates: [
          {
            __VCHART_DEFAULT_DATA_INDEX: 0,
            __VCHART_DEFAULT_DATA_KEY: 0,
            __VCHART_STACK_END: 45,
            __VCHART_STACK_END_PERCENT: 1,
            __VCHART_STACK_KEY: '类别 A',
            __VCHART_STACK_START: 35,
            __VCHART_STACK_START_PERCENT: 0.7777777777777778,
            __VCHART_STACK_TOTAL: 45,
            __VCHART_STACK_TOTAL_PERCENT: 1,
            __VCHART_STACK_TOTAL_TOP: true,
            _editor_dimension_field: '类别 A',
            _editor_type_field: '系列 1',
            _editor_value_field: 45,
            refRelativeSeriesId: 'series-0'
          },
          {
            __VCHART_DEFAULT_DATA_INDEX: 2,
            __VCHART_DEFAULT_DATA_KEY: 2,
            __VCHART_STACK_END: 103,
            __VCHART_STACK_END_PERCENT: 1,
            __VCHART_STACK_KEY: '类别 C',
            __VCHART_STACK_START: 63,
            __VCHART_STACK_START_PERCENT: 0.6116504854368932,
            __VCHART_STACK_TOTAL: 103,
            __VCHART_STACK_TOTAL_PERCENT: 1,
            __VCHART_STACK_TOTAL_TOP: true,
            _editor_dimension_field: '类别 C',
            _editor_type_field: '系列 1',
            _editor_value_field: 103,
            refRelativeSeriesId: 'series-0'
          }
        ],
        coordinatesOffset: [
          {
            x: 0,
            y: -26
          },
          {
            x: 0,
            y: -26
          }
        ],
        endSymbol: {
          originSymbolType: 'solidArrow',
          refX: 0,
          size: 8,
          style: {
            color: '#000',
            fill: '#000',
            fillOpacity: 1,
            lineWidth: 0,
            stroke: '#000'
          },
          symbolType: 'M -1 1.5 L 0 0 L 1 1.5 Z',
          visible: true
        },
        expandDistance: 30,
        id: 'c7457c72-48da-48ab-9a5c-c13e1d00999a',
        interactive: true,
        label: {
          childrenPickable: false,
          labelBackground: {
            padding: {
              bottom: 2,
              left: 4,
              right: 4,
              top: 2
            },
            style: {
              cornerRadius: 4,
              fill: '#fff',
              fillOpacity: 1,
              lineWidth: 1,
              stroke: '#000'
            }
          },
          pickable: true,
          position: 'middle',
          refX: 0,
          refY: 0,
          style: {
            fill: '#1F2329',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: 'bold'
          },
          text: ['+129%']
        },
        line: {
          style: {
            cornerRadius: 6,
            lineDash: [0],
            lineWidth: 1,
            pickStrokeBuffer: 10,
            stroke: '#000'
          }
        },
        name: 'total-diff-line',
        startSymbol: {
          size: 10,
          style: {
            fill: '#606773',
            lineWidth: 0,
            stroke: null
          },
          symbolType: 'triangle',
          visible: false
        },
        type: 'type-step',
        zIndex: 510
      }
    ],
    totalLabel: {
      alwayCalculateTotal: true
    },
    customMark: [
      {
        type: 'component',
        componentType: 'seriesLabel',
        interactive: false,
        style: {
          id: '866ab6c8-0beb-4a50-a253-6989e1b017e7',
          position: 'end',
          label: {
            space: 10,
            style: {
              lineHeight: '100%',
              lineWidth: 1,
              stroke: '#ffffff',
              fontSize: 16,
              fontWeight: 'bold'
            },
            formatConfig: {
              content: 'series'
            }
          }
        }
      }
    ],
    padding: 0,
    animation: false,
    markArea: [],
    animationAppear: false
  };

  const vchart = new VChart(spec, {
    dom: CONTAINER_ID,
    performanceHook: {
      afterVRenderDraw: () => {
        console.log('------');
      }
    },
    renderHooks: {
      afterRender: () => {
        console.log('afterRender');
      }
    }
  });
  vchart.renderSync();

  // Just for the convenience of console debugging, DO NOT COPY!
  window['vchart'] = vchart;
};
run();

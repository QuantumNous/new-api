---
category: examples
group: vscreen
title: Double Axis with Load
keywords: commonChart,comparison,composition,proportion,animation
cover: /vchart/preview/double-axis-load.gif
option: vscreen
---

# Double Axis with Load

Animation execution process:

1. Entrance animation: executed during the first rendering

The entry animation of the line series in the dual-axis chart includes:

- Growth: point primitives and line primitives, growing upward
- Loading: The graphic element is viewed as a whole and expanded to the right

Entry animations for column series in dual-axis charts include:

- Highlight: The transparency of the graphics elements is changed in sequence according to the dimension grouping.

2. Normal animation: Carousel animation every interval.

The normal animations of the line series in the dual-axis chart include:

- Growth: point primitives and line primitives, growing upward
- Loading: The graphic element is viewed as a whole and expanded to the right

The normal animations of the column series in the dual-axis chart include:

- Highlight: The transparency of the graphics elements is changed in sequence according to the dimension grouping.

This case includes:
Admission: Loading, Highlighting + Normal: Loading, Highlighting

## Key option

- `animationAppear`: entrance animation, animation effect during first rendering
- `animationNormal`: Normal animation, after the initial rendering, the animation effect of the chart without any status update, usually executed in a fixed interval rotation
- `animationUpdate`: When the chart updates state, the animation effect of the graphic elements when updating
- `animationEnter`: When the chart updates state, the animation effect of new elements is added
- `animationExit`: When the chart updates state, the animation effect of the primitive when it exits

## Demo source

```javascript livedemo
const spec = {
  // default size
  // width: 400,
  // height: 225,
  type: 'common',
  region: [
    {
      clip: true
    }
  ],
  series: [
    {
      id: 'mainSeries',
      // data mapping
      type: 'bar',
      xField: ['79wJY1PEs5AI', '30001'],
      yField: '10011',
      zIndex: 200,
      seriesField: '30001',
      stackInverse: true,
      // animation
      animation: true,
      animationAppear: {
        point: {
          duration: 1000,
          delayAfter: 4000,
          loop: true
        },
        line: {
          duration: 1000,
          delayAfter: 4000,
          loop: true
        },
        bar: [
          {
            channel: {
              fillOpacity: {
                from: 0.5,
                to: 0.5
              },
              strokeOpacity: {
                from: 0.5,
                to: 0.5
              }
            },
            delay: 4000,
            duration: 800,
            delayAfter: 2400
          },
          {
            channel: {
              fillOpacity: {
                from: 0.5,
                to: 1
              }
            },
            oneByOne: true,
            easing: 'linear',
            controlOptions: {
              immediatelyApply: false
            },
            type: 'fadeIn',
            duration: 800,
            delayAfter: 1600,
            loop: true,
            delay: 800
          },
          {
            channel: {
              fillOpacity: {
                from: 1,
                to: 1
              },
              strokeOpacity: {
                from: 1,
                to: 1
              }
            },
            delay: 1600,
            duration: 800,
            delayAfter: 800
          },
          {
            channel: {
              fillOpacity: {
                from: 1,
                to: 0.5
              }
            },
            oneByOne: true,
            easing: 'linear',
            controlOptions: {
              immediatelyApply: false
            },
            type: 'fadeIn',
            duration: 800,
            delayAfter: 0,
            loop: true,
            delay: 2400
          }
        ]
      },
      // chart style
      bar: {
        state: {
          hover: {
            cursor: 'pointer',
            fillOpacity: 0.8,
            stroke: '#58595B',
            lineWidth: 1,
            zIndex: 500
          },
          selected: {
            cursor: 'pointer',
            fillOpacity: 1,
            stroke: '#58595B',
            lineWidth: 1
          },
          selected_reverse: {
            fillOpacity: 0.3,
            lineWidth: 0.3
          }
        },
        style: {
          cornerRadius: 0,
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 1,
            x1: (datum, context) => {
              return context.vchart.getChart()._globalScale.getScale('gradientX1').scale(datum['30001']);
            },
            y1: (datum, context) => {
              return context.vchart.getChart()._globalScale.getScale('gradientY1').scale(datum['30001']);
            },
            stops: [
              {
                offset: 0,
                color: (datum, context) => {
                  return context.vchart.getChart()._globalScale.getScale('gradientFillStop0').scale(datum['30001']);
                }
              },
              {
                offset: 1,
                color: (datum, context) => {
                  return context.vchart.getChart()._globalScale.getScale('gradientFillStop1').scale(datum['30001']);
                }
              }
            ]
          },
          lineWidth: 2,
          stroke: {
            gradient: 'linear',
            x0: 0,
            y0: 1,
            x1: (datum, context) => {
              return context.vchart.getChart()._globalScale.getScale('gradientX1').scale(datum['30001']);
            },
            y1: (datum, context) => {
              return context.vchart.getChart()._globalScale.getScale('gradientY1').scale(datum['30001']);
            },
            stops: [
              {
                offset: 0,
                color: (datum, context) => {
                  return context.vchart.getChart()._globalScale.getScale('gradientFillStop0').scale(datum['30001']);
                }
              },
              {
                offset: 1,
                color: (datum, context) => {
                  return context.vchart.getChart()._globalScale.getScale('gradientFillStop1').scale(datum['30001']);
                }
              }
            ]
          }
        }
      },
      invalidType: 'break',
      seriesMark: 'line',
      markOverlap: true,
      background: 'rgba(255, 255, 255, 0)',
      barWidth: '50%',
      barBackground: {
        fieldLevel: 1,
        visible: false,
        interactive: false,
        style: {
          cornerRadius: 0,
          fill: 'rgba(255,255,255,1)',
          fillOpacity: 0.25
        }
      },
      data: {
        id: 'mainSeriesData',
        values: [
          {
            10001: 'Profit',
            10003: '0BVoHhqwRdDJ',
            10011: 64,
            30001: 'Profit',
            '79wJY1PEs5AI': 'Labels',
            '0BVoHhqwRdDJ': 64
          },
          {
            10001: 'Profit',
            10003: '0BVoHhqwRdDJ',
            10011: 35,
            30001: 'Profit',
            '79wJY1PEs5AI': 'Tables',
            '0BVoHhqwRdDJ': 35
          },
          {
            10001: 'Profit',
            10003: '0BVoHhqwRdDJ',
            10011: 115,
            30001: 'Profit',
            '79wJY1PEs5AI': 'Storage',
            '0BVoHhqwRdDJ': 115
          },
          {
            10001: 'Profit',
            10003: '0BVoHhqwRdDJ',
            10011: 55,
            30001: 'Profit',
            '79wJY1PEs5AI': 'Furn',
            '0BVoHhqwRdDJ': 55
          },
          {
            10001: 'Profit',
            10003: '0BVoHhqwRdDJ',
            10011: 92,
            30001: 'Profit',
            '79wJY1PEs5AI': 'Art',
            '0BVoHhqwRdDJ': 92
          }
        ],
        fields: {
          10001: {
            alias: '指标名称'
          },
          10011: {
            alias: '指标值(主轴)'
          },
          10012: {
            alias: '指标值(次轴)'
          },
          30001: {
            alias: '图例项',
            domain: ['Profit', 'Sales'],
            sortIndex: 0,
            lockStatisticsByDomain: false
          },
          '79wJY1PEs5AI': {
            alias: 'Product',
            domain: ['Labels', 'Tables', 'Storage', 'Furn', 'Art', 'Labels', 'Tables', 'Storage', 'Furn', 'Art'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '0BVoHhqwRdDJ': {
            alias: 'Profit'
          },
          xjtdvQgEgwt0: {
            alias: 'Sales'
          }
        }
      }
    },
    {
      id: 'subSeries',
      // data mapping
      type: 'line',
      xField: '79wJY1PEs5AI',
      yField: '10012',
      zIndex: 300,
      seriesField: '30001',
      stackInverse: true,
      // animation
      animation: true,
      animationAppear: {
        point: {
          duration: 1000,
          delayAfter: 4000,
          loop: true
        },
        line: {
          duration: 1000,
          delayAfter: 4000,
          loop: true
        },
        bar: [
          {
            channel: {
              fillOpacity: {
                from: 0.5,
                to: 0.5
              },
              strokeOpacity: {
                from: 0.5,
                to: 0.5
              }
            },
            delay: 4000,
            duration: 800,
            delayAfter: 2400
          },
          {
            channel: {
              fillOpacity: {
                from: 0.5,
                to: 1
              }
            },
            oneByOne: true,
            easing: 'linear',
            controlOptions: {
              immediatelyApply: false
            },
            type: 'fadeIn',
            duration: 800,
            delayAfter: 1600,
            loop: true,
            delay: 800
          },
          {
            channel: {
              fillOpacity: {
                from: 1,
                to: 1
              },
              strokeOpacity: {
                from: 1,
                to: 1
              }
            },
            delay: 1600,
            duration: 800,
            delayAfter: 800
          },
          {
            channel: {
              fillOpacity: {
                from: 1,
                to: 0.5
              }
            },
            oneByOne: true,
            easing: 'linear',
            controlOptions: {
              immediatelyApply: false
            },
            type: 'fadeIn',
            duration: 800,
            delayAfter: 0,
            loop: true,
            delay: 2400
          }
        ]
      },
      // mark style
      line: {
        style: {
          curveType: {
            type: 'ordinal',
            field: '30001',
            range: ['linear'],
            domain: ['Profit', 'Sales']
          },
          lineWidth: {
            type: 'ordinal',
            field: '30001',
            range: [2],
            domain: ['Profit', 'Sales']
          },
          lineDash: {
            type: 'ordinal',
            field: '30001',
            range: [[0, 0]],
            domain: ['Profit', 'Sales']
          }
        },
        interactive: false
      },
      point: {
        style: {
          shape: {
            type: 'ordinal',
            field: '30001',
            range: ['circle'],
            domain: ['Profit', 'Sales']
          },
          size: {
            type: 'ordinal',
            field: '30001',
            range: [5.317361552716548],
            domain: ['Profit', 'Sales']
          },
          stroke: {
            field: '30001',
            type: 'ordinal',
            range: ['rgb(0,110,255)', 'rgb(0,229,229)'],
            specified: {}
          },
          strokeOpacity: {
            type: 'ordinal',
            field: '30001',
            range: [1],
            domain: ['Profit', 'Sales']
          },
          fillOpacity: {
            type: 'ordinal',
            field: '30001',
            range: [1],
            domain: ['Profit', 'Sales']
          },
          lineWidth: 0
        }
      },
      // chart style
      invalidType: 'break',
      seriesMark: 'line',
      markOverlap: true,
      background: 'rgba(255, 255, 255, 0)',
      // original data
      data: {
        id: 'subSeriesData',
        values: [
          {
            10001: 'Sales',
            10003: 'xjtdvQgEgwt0',
            10012: 54,
            30001: 'Sales',
            '79wJY1PEs5AI': 'Labels',
            xjtdvQgEgwt0: 54
          },
          {
            10001: 'Sales',
            10003: 'xjtdvQgEgwt0',
            10012: 30,
            30001: 'Sales',
            '79wJY1PEs5AI': 'Tables',
            xjtdvQgEgwt0: 30
          },
          {
            10001: 'Sales',
            10003: 'xjtdvQgEgwt0',
            10012: 60,
            30001: 'Sales',
            '79wJY1PEs5AI': 'Storage',
            xjtdvQgEgwt0: 60
          },
          {
            10001: 'Sales',
            10003: 'xjtdvQgEgwt0',
            10012: 20,
            30001: 'Sales',
            '79wJY1PEs5AI': 'Furn',
            xjtdvQgEgwt0: 20
          },
          {
            10001: 'Sales',
            10003: 'xjtdvQgEgwt0',
            10012: 80,
            30001: 'Sales',
            '79wJY1PEs5AI': 'Art',
            xjtdvQgEgwt0: 80
          }
        ],
        fields: {
          10001: {
            alias: '指标名称'
          },
          10011: {
            alias: '指标值(主轴)'
          },
          10012: {
            alias: '指标值(次轴)'
          },
          30001: {
            alias: '图例项',
            domain: ['Profit', 'Sales'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '79wJY1PEs5AI': {
            alias: 'Product',
            domain: ['Labels', 'Tables', 'Storage', 'Furn', 'Art', 'Labels', 'Tables', 'Storage', 'Furn', 'Art'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '0BVoHhqwRdDJ': {
            alias: 'Profit'
          },
          xjtdvQgEgwt0: {
            alias: 'Sales'
          }
        }
      }
    }
  ],
  // animation
  animation: true,
  // global style
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  labelLayout: 'region',
  stackInverse: true,
  // component style
  axes: [
    {
      type: 'band',
      tick: {
        style: {
          strokeOpacity: 0.2
        },
        visible: false
      },
      grid: {
        visible: false,
        style: {
          zIndex: 150,
          stroke: '#FFFFFF',
          lineWidth: 1,
          lineDash: []
        }
      },
      orient: 'bottom',
      visible: true,
      domainLine: {
        visible: false,
        style: {
          lineWidth: 1,
          stroke: '#d5d7e2'
        }
      },
      title: {
        visible: false,
        space: 5,
        text: '',
        style: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.5)',
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        }
      },
      maxHeight: null,
      autoIndent: false,
      sampling: false,
      zIndex: 200,
      label: {
        visible: true,
        space: 4,
        style: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.65)',
          angle: 0,
          fontFamily: 'D-DIN',
          fontWeight: 'normal',
          direction: 'horizontal',
          maxLineWidth: 174
        },
        autoHide: true,
        autoHideMethod: 'greedy',
        flush: true,
        lastVisible: true,
        autoHideSeparation: 4
      },
      hover: true,
      background: {
        visible: true,
        state: {
          hover: {
            fillOpacity: 0.08,
            fill: '#141414'
          },
          hover_reverse: {
            fillOpacity: 0.08,
            fill: '#141414'
          }
        }
      },
      paddingInner: 0.18,
      paddingOuter: 0.18,
      ticks: true
    },
    {
      type: 'linear',
      tick: {
        size: 4,
        visible: true,
        tickMode: 'd3',
        style: (...args) => {
          return {
            lineWidth: args[1] === 0 || args[1] === args[3].length - 1 ? 2 : 0,
            stroke: 'rgba(0,110,255,1)'
          };
        }
      },
      niceType: 'rough',
      zIndex: 200,
      grid: {
        visible: true,
        style: (...args) => {
          return {
            stroke: 'rgba(255,255,255,0.15)',
            lineWidth: 1,
            lineDash: args[1] === 0 || args[1] === 6 ? [] : [3, 3]
          };
        }
      },
      orient: 'left',
      visible: true,
      domainLine: {
        visible: false,
        style: {
          lineWidth: 1,
          stroke: '#d5d7e2'
        }
      },
      title: {
        visible: false,
        text: '',
        space: 8,
        style: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.5)',
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        }
      },
      autoIndent: false,
      sampling: false,
      label: {
        visible: true,
        space: 6,
        flush: true,
        padding: 0,
        style: {
          fontSize: 12,
          maxLineWidth: 174,
          fill: 'rgba(255,255,255,0.65)',
          angle: 0,
          fontFamily: 'D-DIN',
          fontWeight: 'normal',
          dy: -1,
          direction: 'horizontal'
        },
        autoHide: true,
        autoHideMethod: 'greedy',
        autoHideSeparation: 4,
        rotateAngle: [null],
        labelOverlap: 'custom',
        tighten: false,
        formatMethod: text => text + '.00'
      },
      background: {
        visible: true,
        state: {
          hover: {
            fillOpacity: 0.08,
            fill: '#141414'
          },
          hover_reverse: {
            fillOpacity: 0.08,
            fill: '#141414'
          }
        }
      },
      innerOffset: {
        top: 0
      },
      zero: true,
      nice: true,
      paddingInner: 0.18,
      paddingOuter: 0.18,
      maxWidth: 180,
      ticks: true
    },
    {
      visible: true,
      type: 'linear',
      tick: {
        size: 4,
        visible: true,
        tickMode: 'd3',
        style: (...args) => {
          return {
            lineWidth: args[1] === 0 || args[1] === args[3].length - 1 ? 2 : 0,
            stroke: 'rgba(0,110,255,1)'
          };
        }
      },
      niceType: 'rough',
      zIndex: 200,
      grid: {
        visible: false
      },
      orient: 'right',
      visible: true,
      domainLine: {
        visible: false
      },
      title: {
        visible: false,
        text: '',
        space: 8,
        style: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.5)',
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        }
      },
      autoIndent: false,
      sampling: false,
      label: {
        visible: true,
        space: 6,
        flush: true,
        padding: 0,
        style: {
          visible: true,
          fontSize: 12,
          maxLineWidth: 174,
          fill: 'rgba(255,255,255,0.65)',
          angle: 0,
          fontFamily: 'D-DIN',
          fontWeight: 'normal',
          dy: -1,
          direction: 'horizontal'
        },
        autoHide: true,
        autoHideMethod: 'greedy',
        autoHideSeparation: 4,
        rotateAngle: [null],
        labelOverlap: 'custom',
        tighten: false,
        formatMethod: text => text + '.00'
      },
      background: {
        visible: true,
        state: {
          hover: {
            fillOpacity: 0.08,
            fill: '#141414'
          },
          hover_reverse: {
            fillOpacity: 0.08,
            fill: '#141414'
          }
        }
      },
      innerOffset: {
        top: 0
      },
      zero: true,
      nice: true,
      paddingInner: 0.18,
      paddingOuter: 0.18,
      maxWidth: 180,
      ticks: true
    }
  ],
  legends: [
    {
      type: 'discrete',
      visible: false,
      padding: {
        left: 10,
        right: 0,
        top: 0,
        bottom: 12
      }
    }
  ],
  tooltip: {
    visible: true,
    renderMode: 'canvas',
    mark: {
      visible: true,
      updateContent: (prev, datum, context) => {
        prev.forEach(p => {
          // p.shapeType = tooltipShape
          p.value = p.value + '.00';
        });
        return prev;
      }
    },
    style: {
      panel: {
        padding: {
          top: 5,
          bottom: 10,
          left: 10,
          right: 10
        },
        backgroundColor: 'rgba(8, 28, 48, 0.95)',
        border: {
          color: '#CFCFCF',
          width: 0,
          radius: 2
        },
        shadow: {
          x: 0,
          y: 4,
          blur: 12,
          spread: 0,
          color: 'rgba(0, 0, 0, 0.2)'
        }
      },
      titleLabel: {
        fontSize: 14,
        fontColor: '#FFF',
        fontWeight: 'bold',
        fontFamily: 'D-DIN',
        align: 'left',
        lineHeight: 18
      },
      keyLabel: {
        fontSize: 12,
        fontColor: 'rgba(255,255,255,0.65)',
        fontWeight: 'normal',
        fontFamily: 'SourceHanSansCN-Normal',
        align: 'left',
        lineHeight: 18
      },
      valueLabel: {
        fontSize: 12,
        fontColor: '#FFF',
        fontWeight: 'normal',
        fontFamily: 'D-DIN',
        align: 'right',
        lineHeight: 18
      },
      shape: {
        size: 10,
        spacing: 10
      },
      spaceRow: 10
    },
    dimension: {
      visible: true,
      updateContent: (prev, datum, context) => {
        prev.forEach(p => {
          // p.shapeType = tooltipShape
          p.value = p.value + '.00';
        });
        return prev;
      }
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'rect',
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      }
    },
    gridZIndex: 100,
    yField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    }
  },
  background: 'rgba(0, 0, 0, 1)',
  // color mapping
  scales: [
    {
      id: 'gradientFillStop0',
      type: 'ordinal',
      range: [
        'rgba(0,110,255,0.2)',
        'rgba(0,229,229,0.2)',
        'rgba(46,85,234,0.2)',
        'rgba(184,231,254,0.2)',
        'rgba(0,214,137,0.2)',
        'rgba(183,249,245,0.2)',
        'rgba(251,204,113,0.2)',
        'rgba(244,110,80,0.2)'
      ],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    },
    {
      id: 'gradientFillStop1',
      type: 'ordinal',
      range: [
        'rgb(0,110,255)',
        'rgb(0,229,229)',
        'rgb(46,85,234)',
        'rgb(184,231,254)',
        'rgb(0,214,137)',
        'rgb(183,249,245)',
        'rgb(251,204,113)',
        'rgb(244,110,80)'
      ],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    },
    {
      id: 'gradientStrokeStop0',
      type: 'ordinal',
      range: [
        'rgba(51, 139, 255, 0.2)',
        'rgba(25, 255, 255, 0.2)',
        'rgba(92, 123, 239, 0.2)',
        'rgba(234, 248, 255, 0.2)',
        'rgba(10, 255, 167, 0.2)',
        'rgba(230, 253, 252, 0.2)',
        'rgba(252, 222, 163, 0.2)',
        'rgba(247, 150, 128, 0.2)'
      ],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    },
    {
      id: 'gradientStrokeStop1',
      type: 'ordinal',
      range: [
        'rgba(51, 139, 255, 1)',
        'rgba(25, 255, 255, 1)',
        'rgba(92, 123, 239, 1)',
        'rgba(234, 248, 255, 1)',
        'rgba(10, 255, 167, 1)',
        'rgba(230, 253, 252, 1)',
        'rgba(252, 222, 163, 1)',
        'rgba(247, 150, 128, 1)'
      ],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    },
    {
      id: 'gradientX1',
      type: 'ordinal',
      range: [0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    },
    {
      id: 'gradientY1',
      type: 'ordinal',
      range: [0, 0, 0, 0, 0, 0, 0, 0],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    }
  ],
  // original data
  data: [
    {
      id: 'data',
      values: [
        {
          10001: 'Profit',
          10003: '0BVoHhqwRdDJ',
          10011: 64,
          30001: 'Profit',
          '79wJY1PEs5AI': 'Labels',
          '0BVoHhqwRdDJ': 64
        },
        {
          10001: 'Profit',
          10003: '0BVoHhqwRdDJ',
          10011: 35,
          30001: 'Profit',
          '79wJY1PEs5AI': 'Tables',
          '0BVoHhqwRdDJ': 35
        },
        {
          10001: 'Profit',
          10003: '0BVoHhqwRdDJ',
          10011: 115,
          30001: 'Profit',
          '79wJY1PEs5AI': 'Storage',
          '0BVoHhqwRdDJ': 115
        },
        {
          10001: 'Profit',
          10003: '0BVoHhqwRdDJ',
          10011: 55,
          30001: 'Profit',
          '79wJY1PEs5AI': 'Furn',
          '0BVoHhqwRdDJ': 55
        },
        {
          10001: 'Profit',
          10003: '0BVoHhqwRdDJ',
          10011: 92,
          30001: 'Profit',
          '79wJY1PEs5AI': 'Art',
          '0BVoHhqwRdDJ': 92
        },
        {
          10001: 'Sales',
          10003: 'xjtdvQgEgwt0',
          10012: 54,
          30001: 'Sales',
          '79wJY1PEs5AI': 'Labels',
          xjtdvQgEgwt0: 54
        },
        {
          10001: 'Sales',
          10003: 'xjtdvQgEgwt0',
          10012: 30,
          30001: 'Sales',
          '79wJY1PEs5AI': 'Tables',
          xjtdvQgEgwt0: 30
        },
        {
          10001: 'Sales',
          10003: 'xjtdvQgEgwt0',
          10012: 60,
          30001: 'Sales',
          '79wJY1PEs5AI': 'Storage',
          xjtdvQgEgwt0: 60
        },
        {
          10001: 'Sales',
          10003: 'xjtdvQgEgwt0',
          10012: 20,
          30001: 'Sales',
          '79wJY1PEs5AI': 'Furn',
          xjtdvQgEgwt0: 20
        },
        {
          10001: 'Sales',
          10003: 'xjtdvQgEgwt0',
          10012: 80,
          30001: 'Sales',
          '79wJY1PEs5AI': 'Art',
          xjtdvQgEgwt0: 80
        }
      ],
      fields: {
        10001: {
          alias: '指标名称'
        },
        10011: {
          alias: '指标值(主轴)'
        },
        10012: {
          alias: '指标值(次轴)'
        },
        30001: {
          alias: '图例项',
          domain: ['Profit', 'Sales'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        '79wJY1PEs5AI': {
          alias: 'Product',
          domain: ['Labels', 'Tables', 'Storage', 'Furn', 'Art', 'Labels', 'Tables', 'Storage', 'Furn', 'Art'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        '0BVoHhqwRdDJ': {
          alias: 'Profit'
        },
        xjtdvQgEgwt0: {
          alias: 'Sales'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)

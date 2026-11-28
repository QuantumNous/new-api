---
category: examples
group: vscreen
title: 带生长动画的双向条形图
keywords: commonChart,comparison,composition,proportion,animation
cover: /vchart/preview/bilateral-growth.gif
option: vscreen
---

# 带生长动画的双向条形图

动画执行过程:

1. 入场动画: 初次渲染时执行

- 生长: 图元的高度从 0 开始, 向上/右生长
- 高亮: 图元按照维度分组依次改变透明度

2. 常态动画: 每隔 interval 时长轮播执行动画

- 生长: 图元的高度从 0 开始, 向上/右生长
- 高亮: 图元按照维度分组依次改变透明度

此案例包含:
入场:生长 + 常态:生长

## 关键配置

- `animationAppear`: 入场动画, 初次渲染时的动画效果
- `animationNormal`: 常态动画, 初次渲染后, 图表在没有任何状态更新情况下的动画效果, 通常以固定的间隔轮播执行
- `animationUpdate`: 图表更新状态时, 图元在更新时的动画效果
- `animationEnter`: 图表更新状态时, 图元在新增时的动画效果
- `animationExit`: 图表更新状态时, 图元在退场时的动画效果

## 代码演示

```javascript livedemo
const spec = {
  // default size
  // width: 400,
  // height: 225,
  type: 'common',
  series: [
    {
      id: 'mainSeries',
      type: 'bar',
      yField: 'ur7vPwY7lxha',
      xField: '10011',
      seriesField: '30001',
      direction: 'horizontal',
      regionId: 'mainRegion',
      // animation
      animation: true,
      animationAppear: {
        bar: {
          type: 'growWidthIn',
          oneByOne: false,
          duration: 1000,
          delayAfter: 4000,
          loop: true
        }
      },
      animationUpdate: false,
      animationEnter: false,
      animationExit: false,
      // original data
      data: {
        id: 'mainSeriesData',
        values: [
          {
            10001: 'Sales',
            10003: '0b2h60Cd1f86',
            10011: 20,
            30001: 'Sales',
            ur7vPwY7lxha: '河北',
            '0b2h60Cd1f86': 20
          },
          {
            10001: 'Sales',
            10003: '0b2h60Cd1f86',
            10011: 50,
            30001: 'Sales',
            ur7vPwY7lxha: '山西',
            '0b2h60Cd1f86': 50
          },
          {
            10001: 'Sales',
            10003: '0b2h60Cd1f86',
            10011: 40,
            30001: 'Sales',
            ur7vPwY7lxha: '内蒙古',
            '0b2h60Cd1f86': 40
          },
          {
            10001: 'Sales',
            10003: '0b2h60Cd1f86',
            10011: 50,
            30001: 'Sales',
            ur7vPwY7lxha: '辽宁',
            '0b2h60Cd1f86': 50
          },
          {
            10001: 'Sales',
            10003: '0b2h60Cd1f86',
            10011: 35,
            30001: 'Sales',
            ur7vPwY7lxha: '吉林',
            '0b2h60Cd1f86': 35
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
            domain: ['Sales', 'Profit'],
            sortIndex: 0
          },
          ur7vPwY7lxha: {
            alias: 'Province',
            domain: ['河北', '山西', '内蒙古', '辽宁', '吉林', '河北', '山西', '内蒙古', '辽宁', '吉林'],
            sortIndex: 0
          },
          '0b2h60Cd1f86': {
            alias: 'Sales'
          },
          ubskhJmGe20y: {
            alias: 'Profit'
          }
        }
      },
      stack: false,
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
      barWidth: '60%',
      barBackground: {
        fieldLevel: 1,
        visible: false,
        interactive: false,
        style: {
          cornerRadius: 0,
          fill: 'rgba(255,255,255,1)',
          fillOpacity: 0.25
        }
      }
    },
    {
      id: 'subSeries',
      type: 'bar',
      yField: 'ur7vPwY7lxha',
      xField: '10012',
      seriesField: '30001',
      direction: 'horizontal',
      regionId: 'subRegion',
      // animation
      animation: true,
      animationAppear: {
        bar: {
          type: 'growWidthIn',
          oneByOne: false,
          duration: 1000,
          delayAfter: 4000,
          loop: true
        }
      },
      animationEnter: false,
      animationUpdate: false,
      animationExit: false,
      // original data
      data: {
        id: 'subSeriesData',
        values: [
          {
            10001: 'Profit',
            10003: 'ubskhJmGe20y',
            10012: 60,
            30001: 'Profit',
            ubskhJmGe20y: 60,
            ur7vPwY7lxha: '河北'
          },
          {
            10001: 'Profit',
            10003: 'ubskhJmGe20y',
            10012: 30,
            30001: 'Profit',
            ubskhJmGe20y: 30,
            ur7vPwY7lxha: '山西'
          },
          {
            10001: 'Profit',
            10003: 'ubskhJmGe20y',
            10012: 50,
            30001: 'Profit',
            ubskhJmGe20y: 50,
            ur7vPwY7lxha: '内蒙古'
          },
          {
            10001: 'Profit',
            10003: 'ubskhJmGe20y',
            10012: 10,
            30001: 'Profit',
            ubskhJmGe20y: 10,
            ur7vPwY7lxha: '辽宁'
          },
          {
            10001: 'Profit',
            10003: 'ubskhJmGe20y',
            10012: 20,
            30001: 'Profit',
            ubskhJmGe20y: 20,
            ur7vPwY7lxha: '吉林'
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
            domain: ['Sales', 'Profit'],
            sortIndex: 0
          },
          ur7vPwY7lxha: {
            alias: 'Province',
            domain: ['河北', '山西', '内蒙古', '辽宁', '吉林', '河北', '山西', '内蒙古', '辽宁', '吉林'],
            sortIndex: 0
          },
          '0b2h60Cd1f86': {
            alias: 'Sales'
          },
          ubskhJmGe20y: {
            alias: 'Profit'
          }
        }
      },
      stack: false,
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
      barWidth: '60%',
      barBackground: {
        fieldLevel: 1,
        visible: false,
        interactive: false,
        style: {
          cornerRadius: 0,
          fill: 'rgba(255,255,255,1)',
          fillOpacity: 0.25
        }
      }
    }
  ],
  // global style
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  background: 'rgba(0, 0, 0, 1)',
  // layout
  layout: {
    type: 'grid',
    row: 3,
    col: 4,
    elements: [
      {
        modelId: 'legend-discrete',
        col: 0,
        colSpan: 4,
        row: 0
      },
      {
        modelId: 'mainRegion',
        col: 0,
        row: 1
      },
      {
        modelId: 'dimensionAxis',
        col: 1,
        row: 1
      },
      {
        modelId: 'subRegion',
        col: 3,
        row: 1
      },
      {
        modelId: 'measureAxisLeft',
        col: 0,
        row: 2
      },
      {
        modelId: 'measureAxisRight',
        col: 3,
        row: 2
      },
      {
        modelId: 'dimensionAxis2',
        col: 2,
        row: 1
      }
    ]
  },
  region: [
    {
      clip: true,
      id: 'mainRegion'
    },
    {
      id: 'subRegion'
    }
  ],
  // component style
  axes: [
    {
      id: 'dimensionAxis',
      type: 'band',
      tick: {
        style: {
          strokeOpacity: 0.2
        }
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
      orient: 'left',
      visible: true,
      domainLine: {
        visible: false
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
        space: 16,
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
        containerAlign: 'center',
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
      paddingInner: 0.35,
      paddingOuter: 0.2,
      maxWidth: 190,
      inverse: true,
      offsetX: 8,
      regionId: 'mainRegion',
      seriesId: 'mainSeries',
      ticks: true,
      bandPadding: 0.22
    },
    {
      id: 'measureAxisLeft',
      type: 'linear',
      tick: {
        size: 4,
        visible: true,
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
            lineDash: args[1] === 0 || args[1] === 5 ? [] : [3, 3]
          };
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
        space: 4,
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
        formatMethod: text => text.toFixed(2)
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
      regionId: 'mainRegion',
      seriesId: 'mainSeries',
      inverse: true,
      bandPadding: 0.22,
      ticks: true
    },
    {
      id: 'measureAxisRight',
      type: 'linear',
      tick: {
        size: 4,
        visible: true,
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
            lineDash: args[1] === 0 || args[1] === 4 ? [] : [3, 3]
          };
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
        space: 4,
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
        formatMethod: text => text.toFixed(2)
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
      regionId: 'subRegion',
      seriesId: 'subSeries',
      bandPadding: 0.22,
      ticks: true
    },
    {
      id: 'dimensionAxis2',
      type: 'band',
      tick: {
        style: {
          strokeOpacity: 0.2
        }
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
      orient: 'left',
      visible: false,
      domainLine: {
        visible: false
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
        space: 16,
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
        containerAlign: 'center',
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
      paddingInner: 0.35,
      paddingOuter: 0.2,
      maxWidth: 190,
      inverse: true,
      offsetX: 8,
      regionId: 'subRegion',
      seriesId: 'subSeries',
      ticks: true,
      bandPadding: 0.22
    }
  ],
  legends: [
    {
      type: 'discrete',
      visible: true,
      id: 'legend-discrete',
      orient: 'top',
      position: 'end',
      layoutType: 'normal',
      maxRow: 1,
      title: {
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)'
        }
      },
      layoutLevel: 70,
      item: {
        focus: true,
        focusIconStyle: {
          size: 14
        },
        maxWidth: 400,
        spaceRow: 0,
        spaceCol: 0,
        padding: {
          left: 10,
          right: -10,
          top: 0,
          bottom: 5
        },
        background: {
          visible: false,
          style: {
            fillOpacity: 0.001
          }
        },
        label: {
          style: {
            fontSize: 12,
            fill: 'rgba(255,255,255,0.45)',
            fontFamily: 'D-DIN',
            fontWeight: 'normal'
          },
          state: {
            unSelected: {
              fillOpacity: 0.2
            }
          }
        },
        shape: {
          style: {
            lineWidth: 0,
            symbolType: 'square',
            size: 12,
            fillOpacity: 1,
            width: 12,
            height: 7.416
          }
        }
      },
      pager: {
        layout: 'horizontal',
        padding: 0,
        textStyle: {},
        space: 0,
        handler: {
          preShape: 'triangleLeft',
          nextShape: 'triangleRight',
          style: {},
          state: {
            disable: {}
          }
        }
      },
      alignSelf: 'end',
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
    yField: {
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
    xField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    }
  },
  // color mapping
  scales: [
    {
      id: 'gradientFillStop0',
      type: 'ordinal',
      range: [
        'rgb(0,110,255)',
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
        'rgba(0,110,255,0.2)',
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
        'rgba(51, 139, 255, 1)',
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
        'rgba(51, 139, 255, 0.2)',
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
      range: [1, 1, 1, 1, 1, 1, 1, 1],
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
      range: [1, 1, 1, 1, 1, 1, 1, 1],
      domain: [
        {
          dataId: 'data',
          fields: ['30001']
        }
      ]
    }
  ],
  hash: 'f41d6612e27bc600e818775da5cf74b8',
  animation: true
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)

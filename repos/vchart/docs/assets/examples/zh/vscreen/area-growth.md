---
category: examples
group: vscreen
title: 带生长动画的面积图
keywords: areaChart,comparison,trend,area,animation
cover: /vchart/preview/area-growth.gif
option: vscreen
---

# 带生长动画的面积图

动画执行过程:

1. 入场动画: 初次渲染时执行

- 生长: 点图元和面积图元, 向上生长
- 加载: 图元看作一个整体, 向右展开

2. 常态动画: 每隔 interval 时长轮播执行动画
   面积图的常态动画包括:

- 生长: 点图元和面积图元, 向上生长
- 加载: 图元看作一个整体, 向右展开
- 流光: 流光图元从面积图元的起点运动到终点

此案例包含:
入场:生长 + 常态: 生长和流光

## 关键配置

- `animationAppear`: 入场动画, 初次渲染时的动画效果
- `animationNormal`: 常态动画, 初次渲染后, 图表在没有任何状态更新情况下的动画效果, 通常以固定的间隔轮播执行
- `animationUpdate`: 图表更新状态时, 图元在更新时的动画效果
- `animationEnter`: 图表更新状态时, 图元在新增时的动画效果
- `animationExit`: 图表更新状态时, 图元在退场时的动画效果

## 代码演示

```javascript livedemo
// normal animation config
const strokeColor = 'white';
const interval = 5000;
const duration = 1000;
const spec = {
  // default size
  // width: 400,
  // height: 225,
  // data mapping
  type: 'area',
  xField: ['beinirRbfVnf'],
  yField: ['10002'],
  direction: 'vertical',
  sortDataByAxis: true,
  seriesField: '30001',
  // animation
  animation: true,
  animationAppear: {
    area: {
      type: 'growPointsYIn',
      options: {
        orient: 'negative'
      },
      oneByOne: false,
      easing: 'linear',
      duration: 1000
    },
    point: {
      type: 'moveIn',
      options: { direction: 'y', orient: 'negative' },
      easing: 'linear',
      duration: 1000
    }
  },
  animationNormal: {
    area: [
      {
        type: 'growPointsYIn',
        options: {
          orient: 'negative'
        },
        oneByOne: false,
        startTime: interval,
        easing: 'linear',
        duration,
        delayAfter: interval + duration,
        loop: true,
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: true,
        startTime: interval,
        delay: duration,
        delayAfter: duration,
        duration,
        easing: 'linear',
        custom: VRender.StreamLight,
        customParameters: (...args) => {
          return {
            streamLength: 20,
            attribute: {
              stroke: strokeColor,
              strokeOpacity: 0.8,
              lineWidth: args[1].attribute?.lineWidth ?? 1
            }
          };
        }
      }
    ],
    point: [
      {
        loop: true,
        startTime: interval,
        delayAfter: interval + duration,
        duration,
        easing: 'linear',
        channel: {
          outerBorder: {
            from: {
              distance: 0,
              strokeOpacity: 1
            },
            to: (...args) => {
              return {
                distance: 16,
                strokeOpacity: 0.00000001, // canvas bug, 待优化
                stroke: args[1].attribute.fill
              };
            }
          }
        },
        custom: (ratio, from, to, step, graphic) => {
          graphic.attribute.strokeOpacity = ratio * (to.strokeOpacity - from.strokeOpacity) + from.strokeOpacity;
          graphic.attribute.outerBorder = {
            distance: ratio * (to.outerBorder.distance - from.outerBorder.distance) + from.outerBorder.distance,
            strokeOpacity:
              ratio * (to.outerBorder.strokeOpacity - from.outerBorder.strokeOpacity) + from.outerBorder.strokeOpacity,
            stroke: to.outerBorder.stroke
          };
          graphic.addUpdatePositionTag();
          graphic.addUpdateShapeAndBoundsTag();
        }
      }
    ]
  },
  // global style
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  background: 'rgba(0, 0, 0, 1)',
  labelLayout: 'region',
  // chart style
  seriesMark: 'line',
  markOverlap: true,
  invalidType: 'break',
  stackInverse: true,
  // mark style
  point: {
    style: {
      shape: {
        type: 'ordinal',
        field: '30001',
        range: ['circle'],
        domain: ['2023', '2022']
      },
      size: {
        type: 'ordinal',
        field: '30001',
        range: [5.317361552716548],
        domain: ['2023', '2022']
      },
      fill: {
        field: '30001',
        type: 'ordinal',
        range: ['#006EFF', '#00E5E5'],
        specified: {},
        domain: ['2023', '2022']
      },
      stroke: {
        field: '30001',
        type: 'ordinal',
        range: ['#006EFF', '#00E5E5'],
        specified: {},
        domain: ['2023', '2022']
      },
      strokeOpacity: {
        type: 'ordinal',
        field: '30001',
        range: [1],
        domain: ['2023', '2022']
      },
      fillOpacity: {
        type: 'ordinal',
        field: '30001',
        range: [1],
        domain: ['2023', '2022']
      }
    },
    state: {
      hover: {
        lineWidth: 2,
        fillOpacity: 1,
        strokeOpacity: 1,
        scaleX: 1.5,
        scaleY: 1.5
      }
    }
  },
  line: {
    style: {
      curveType: {
        type: 'ordinal',
        field: '30001',
        range: ['linear'],
        domain: ['2023', '2022']
      },
      lineWidth: {
        type: 'ordinal',
        field: '30001',
        range: [2],
        domain: ['2023', '2022']
      },
      lineDash: {
        type: 'ordinal',
        field: '30001',
        range: [[0, 0]],
        domain: ['2023', '2022']
      }
    }
  },
  area: {
    style: {
      curveType: {
        type: 'ordinal',
        field: '30001',
        range: ['linear'],
        domain: ['2023', '2022']
      }
    }
  },
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
          stroke: 'rgba(57,57,57,1)',
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
          stroke: '#FFFFFF'
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
      paddingInner: 0.8,
      paddingOuter: 0.05,
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
            lineDash: args[1] === 0 || args[1] === 5 ? [] : [3, 3]
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
        top: 3.5449077018110318
      },
      zero: true,
      nice: true,
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
          visible: false,
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
        tighten: false
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
        top: 3.5449077018110318
      },
      zero: true,
      nice: true,
      ticks: true
    }
  ],
  color: {
    field: '30001',
    type: 'ordinal',
    range: ['#006EFF', '#00E5E5'],
    specified: {},
    domain: ['2023', '2022']
  },
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
            fillOpacity: 1,
            size: 12,
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
  axesPadding: true,
  // original data
  data: [
    {
      id: 'data',
      values: [
        {
          10001: 'Sales',
          10002: 30,
          10003: 'y1oUBzJX8Uny',
          30001: '2023',
          beinirRbfVnf: 'Labels',
          y1oUBzJX8Uny: 30,
          qyRxYk2ctix0: '2023'
        },
        {
          10001: 'Sales',
          10002: 24,
          10003: 'y1oUBzJX8Uny',
          30001: '2022',
          beinirRbfVnf: 'Labels',
          y1oUBzJX8Uny: 24,
          qyRxYk2ctix0: '2022'
        },
        {
          10001: 'Sales',
          10002: 20,
          10003: 'y1oUBzJX8Uny',
          30001: '2023',
          beinirRbfVnf: 'Tables',
          y1oUBzJX8Uny: 20,
          qyRxYk2ctix0: '2023'
        },
        {
          10001: 'Sales',
          10002: 10,
          10003: 'y1oUBzJX8Uny',
          30001: '2022',
          beinirRbfVnf: 'Tables',
          y1oUBzJX8Uny: 10,
          qyRxYk2ctix0: '2022'
        },
        {
          10001: 'Sales',
          10002: 40,
          10003: 'y1oUBzJX8Uny',
          30001: '2023',
          beinirRbfVnf: 'Storage',
          y1oUBzJX8Uny: 40,
          qyRxYk2ctix0: '2023'
        },
        {
          10001: 'Sales',
          10002: 20,
          10003: 'y1oUBzJX8Uny',
          30001: '2022',
          beinirRbfVnf: 'Storage',
          y1oUBzJX8Uny: 20,
          qyRxYk2ctix0: '2022'
        },
        {
          10001: 'Sales',
          10002: 10,
          10003: 'y1oUBzJX8Uny',
          30001: '2023',
          beinirRbfVnf: 'Furn',
          y1oUBzJX8Uny: 10,
          qyRxYk2ctix0: '2023'
        },
        {
          10001: 'Sales',
          10002: 10,
          10003: 'y1oUBzJX8Uny',
          30001: '2022',
          beinirRbfVnf: 'Furn',
          y1oUBzJX8Uny: 10,
          qyRxYk2ctix0: '2022'
        },
        {
          10001: 'Sales',
          10002: 50,
          10003: 'y1oUBzJX8Uny',
          30001: '2023',
          beinirRbfVnf: 'Art',
          y1oUBzJX8Uny: 50,
          qyRxYk2ctix0: '2023'
        },
        {
          10001: 'Sales',
          10002: 30,
          10003: 'y1oUBzJX8Uny',
          30001: '2022',
          beinirRbfVnf: 'Art',
          y1oUBzJX8Uny: 30,
          qyRxYk2ctix0: '2022'
        }
      ],
      fields: {
        10001: {
          alias: '指标名称'
        },
        10002: {
          alias: '指标值'
        },
        30001: {
          alias: '图例项',
          domain: ['2023', '2022'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        beinirRbfVnf: {
          alias: 'Product',
          domain: ['Labels', 'Labels', 'Tables', 'Tables', 'Storage', 'Storage', 'Furn', 'Furn', 'Art', 'Art'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        qyRxYk2ctix0: {
          alias: 'Year'
        },
        y1oUBzJX8Uny: {
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

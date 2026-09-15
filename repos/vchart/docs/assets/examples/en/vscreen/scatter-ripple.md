---
category: examples
group: vscreen
title: Scatter with Ripple
cover: /vchart/preview/scatter-ripple.gif
optio: vscreen
---

# Scatter with Ripple

Animation execution process:

1. Entrance animation: executed during the first rendering

- Fly in: Click outside the canvas of the primitive to fly into its final position
- Scaling: The point primitive size is enlarged from 0 to the final size

2. Normal animation: Carousel animation every interval.

- Fly in: Click outside the canvas of the primitive to fly into its final position
- Scaling: The point primitive size is enlarged from 0 to the final size
- Ripple: The outer circle of the point primitive scales from large to small, and eventually disappears

This case includes:
Admission: Fly in + Normal: Fly in and Ripple

## Key option

- `animationAppear`: entrance animation, animation effect during first rendering
- `animationNormal`: Normal animation, after the initial rendering, the animation effect of the chart without any status update, usually executed in a fixed interval rotation
- `animationUpdate`: When the chart updates state, the animation effect of the graphic elements when updating
- `animationEnter`: When the chart updates state, the animation effect of new elements is added
- `animationExit`: When the chart updates state, the animation effect of the primitive when it exits

## Demo source

```javascript livedemo
// normal animation config and util
const interval = 5000;
const move_in_duration = 1000;
const ripple_duration = 1000;

const spec = {
  // default size
  // width: 400,
  // height: 225,
  // data mapping
  type: 'scatter',
  xField: 'ziEKUN3YCZ8J',
  yField: 'KEG6J5Jz0Ps0',
  seriesField: 'bEZTavz6Hy8o',
  sizeField: '7G6bpngffPka',
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  // animation
  animation: true,
  animationAppear: {
    point: [
      {
        loop: false,
        startTime: 0,
        duration: 500,
        easing: 'linear',
        type: 'moveIn',
        delayAfter: 0,
        options: {
          direction: 'y',
          orient: 'negative',
          point: (...args) => {
            const y = args[1].attribute.y;
            const { height } = args[2];
            return { y: height - 100 };
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: false,
        startTime: 0,
        duration: 500,
        easing: 'linear',
        delayAfter: 0,
        channel: {
          fillOpacity: {
            from: (...args) => {
              return (args[1].attribute.fillOpacity ?? 1) * 0.5;
            }
          },
          size: {
            from: (...args) => {
              return args[1].attribute.size;
            }
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: false,
        startTime: 0,
        duration: 500,
        easing: 'linear',
        delay: 500,
        delayAfter: 0,
        channel: {
          fill: {
            from: (...args) => {
              return args[1].attribute.fill;
            }
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      }
    ]
  },
  animationNormal: {
    point: [
      {
        loop: true,
        startTime: interval,
        duration: move_in_duration / 2,
        easing: 'linear',
        type: 'moveIn',
        delayAfter: interval + ripple_duration + move_in_duration / 2,
        options: {
          direction: 'y',
          orient: 'negative',
          point: (...args) => {
            const y = args[1].attribute.y;
            const { height } = args[2];
            return { y: height - 100 };
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: true,
        startTime: interval,
        duration: move_in_duration / 2,
        easing: 'linear',
        delayAfter: interval + ripple_duration + move_in_duration / 2,
        channel: {
          fillOpacity: {
            from: (...args) => {
              return (args[1].attribute.fillOpacity ?? 1) * 0.5;
            }
          },
          size: {
            from: (...args) => {
              return args[1].attribute.size;
            }
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: true,
        startTime: interval,
        duration: move_in_duration / 2,
        easing: 'linear',
        delay: move_in_duration / 2,
        delayAfter: interval + ripple_duration,
        channel: {
          fill: {
            from: (...args) => {
              return args[1].attribute.fill;
            }
          }
        },
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        loop: true,
        startTime: interval,
        delayAfter: interval,
        duration: ripple_duration,
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
        },
        controlOptions: {
          immediatelyApply: false
        }
      }
    ]
  },

  // chart mapping
  size: {
    type: 'linear',
    range: [7.0898154036220635, 24.814353912677223],
    domain: [20, 80]
  },
  color: {
    field: 'bEZTavz6Hy8o',
    type: 'linear',
    range: ['#2e55ea', '#006eff'],
    domain: [20, 80]
  },
  point: {
    state: {
      hover: {
        cursor: 'pointer',
        fillOpacity: 0.8,
        stroke: '#58595B',
        lineWidth: 1,
        zIndex: 500
      }
    }
  },
  // global style
  background: 'rgba(0, 0, 0, 1)',
  invalidType: 'ignore',
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
        autoHideSeparation: 4,
        formatMethod: text => text.toFixed(2)
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
      innerOffset: {
        right: 13.293403881791368,
        top: 30
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
      zero: true,
      nice: true,
      paddingInner: 0.18,
      paddingOuter: 0.18,
      maxWidth: 180,
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
      innerOffset: {
        right: 13.293403881791368,
        top: 30
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
      type: 'color',
      slidable: true,
      title: {
        visible: true,
        text: 'Sales',
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)',
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        },
        space: 0
      },
      visible: true,
      id: 'legend-color',
      orient: 'top',
      position: 'end',
      layoutType: 'normal-inline',
      field: ['bEZTavz6Hy8o'],
      layoutLevel: 50,
      maxHeight: 130,
      rail: {
        width: 100,
        height: 4,
        style: {
          fill: 'rgba(0,0,0,0.04)'
        }
      },
      handler: {
        style: {
          shadowBlur: 0,
          shadowColor: false,
          stroke: '#fff',
          lineWidth: 3,
          size: 9,
          outerBorder: {
            distance: 1.5,
            lineWidth: 0.5,
            stroke: '#cccccc'
          }
        }
      },
      align: 'left',
      alignSelf: 'end',
      handlerText: {
        style: {
          maxLineWidth: 200,
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          dx: 0,
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        }
      },
      startText: {
        visible: false
      },
      endText: {
        visible: false
      },
      padding: {
        left: 10,
        right: 0,
        top: 0,
        bottom: 12
      },
      maxWidth: 150
    },
    {
      type: 'size',
      slidable: true,
      visible: true,
      title: {
        visible: true,
        text: 'Sales',
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)',
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        },
        space: 0
      },
      handlerText: {
        style: {
          maxLineWidth: 200,
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          dx: 0,
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        }
      },
      id: 'legend-size',
      orient: 'top',
      position: 'end',
      layoutType: 'normal-inline',
      field: ['7G6bpngffPka'],
      layoutLevel: 60,
      maxHeight: 130,
      track: {
        style: {
          fill: 'rgba(20,20,20,0.1)'
        }
      },
      rail: {
        width: 100,
        height: 4,
        style: {
          fill: 'rgba(0,0,0,0.04)'
        }
      },
      handler: {
        style: {
          symbolType: 'M0,6L-3.5,2.5\n    v-5\n    h7\n    v5\n    Z',
          size: 8,
          shadowBlur: 0,
          shadowColor: false,
          outerBorder: {
            stroke: '#AEB8C6',
            lineWidth: 1,
            strokeOpacity: 0.5
          }
        }
      },
      align: 'left',
      alignSelf: 'end',
      startText: {
        visible: false
      },
      endText: {
        visible: false
      },
      padding: {
        left: 10,
        right: 0,
        top: 0,
        bottom: 12
      },
      maxWidth: 150
    }
  ],
  tooltip: {
    visible: true,
    renderMode: 'canvas',
    mark: {
      visible: true
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
      visible: false
    }
  },
  crosshair: {
    xField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    },
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
  // original data
  data: [
    {
      id: 'data',
      values: [
        {
          30001: 'Labels',
          umoptvaLq7oB: 'Labels',
          KEG6J5Jz0Ps0: 64,
          bEZTavz6Hy8o: 54,
          '7G6bpngffPka': 54,
          ziEKUN3YCZ8J: 54
        },
        {
          30001: 'Tables',
          umoptvaLq7oB: 'Tables',
          KEG6J5Jz0Ps0: 35,
          bEZTavz6Hy8o: 30,
          '7G6bpngffPka': 30,
          ziEKUN3YCZ8J: 30
        },
        {
          30001: 'Storage',
          umoptvaLq7oB: 'Storage',
          KEG6J5Jz0Ps0: 115,
          bEZTavz6Hy8o: 60,
          '7G6bpngffPka': 60,
          ziEKUN3YCZ8J: 60
        },
        {
          30001: 'Furn',
          umoptvaLq7oB: 'Furn',
          KEG6J5Jz0Ps0: 55,
          bEZTavz6Hy8o: 20,
          '7G6bpngffPka': 20,
          ziEKUN3YCZ8J: 20
        },
        {
          30001: 'Art',
          umoptvaLq7oB: 'Art',
          KEG6J5Jz0Ps0: 92,
          bEZTavz6Hy8o: 80,
          '7G6bpngffPka': 80,
          ziEKUN3YCZ8J: 80
        }
      ],
      fields: {
        30001: {
          alias: '细分'
        },
        bEZTavz6Hy8o: {
          alias: 'Sales'
        },
        '7G6bpngffPka': {
          alias: 'Sales'
        },
        umoptvaLq7oB: {
          alias: 'Product'
        },
        ziEKUN3YCZ8J: {
          alias: 'Sales',
          sortIndex: 0
        },
        KEG6J5Jz0Ps0: {
          alias: 'Profit'
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

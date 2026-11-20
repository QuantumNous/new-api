---
category: examples
group: vscreen
title: 带径向动画的雷达图
keywords: radarChart,comparison,line,circle,animation
cover: /vchart/preview/radar-ridial.gif
option: vscreen
---

# 带径向动画的雷达图

动画执行过程:

1. 入场动画: 初次渲染时执行

- 径向: 雷达图整体按角度展开
- 缩放: 雷达图整体缩放

2. 常态动画: 每隔 interval 时长轮播执行动画

- 涟漪: 点图元外圈圆从大到小缩放, 最终消失

此案例包含:
入场:径向 + 常态:涟漪

## 关键配置

- `animationAppear`: 入场动画, 初次渲染时的动画效果
- `animationNormal`: 常态动画, 初次渲染后, 图表在没有任何状态更新情况下的动画效果, 通常以固定的间隔轮播执行
- `animationUpdate`: 图表更新状态时, 图元在更新时的动画效果
- `animationEnter`: 图表更新状态时, 图元在新增时的动画效果
- `animationExit`: 图表更新状态时, 图元在退场时的动画效果

## 代码演示

```javascript livedemo
// normal animation config and util
const interval = 5000;
const duration = 1000;

const spec = {
  // default size
  // width: 400,
  // height: 225,
  type: 'radar',
  outerRadius: 0.8,
  categoryField: 'BHCimAqm0QGN',
  valueField: '10002',
  seriesField: '30001',
  // animtion
  animation: true,
  animationAppear: {
    preset: 'clipIn',
    duration: 1000,
    easing: 'linear'
  },
  animationNormal: {
    point: {
      loop: true,
      startTime: interval,
      delayAfter: interval,
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
      },
      controlOptions: {
        immediatelyApply: false
      }
    }
  },
  // color mapping
  color: {
    field: '30001',
    type: 'ordinal',
    range: ['#006EFF'],
    specified: {},
    domain: ['Sales']
  },
  // global style
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  background: 'rgba(0, 0, 0, 1)',
  // chart style
  seriesMark: 'line',
  markOverlap: false,
  sortDataByAxis: true,
  invalidType: 'zero',
  point: {
    style: {
      shape: {
        type: 'ordinal',
        field: '30001',
        range: ['circle'],
        domain: ['Sales']
      },
      size: {
        type: 'ordinal',
        field: '30001',
        range: [5.317361552716548],
        domain: ['Sales']
      },
      fill: {
        field: '30001',
        type: 'ordinal',
        range: ['#006EFF'],
        specified: {},
        domain: ['Sales']
      },
      stroke: {
        field: '30001',
        type: 'ordinal',
        range: ['#006EFF'],
        specified: {},
        domain: ['Sales']
      },
      strokeOpacity: {
        type: 'ordinal',
        field: '30001',
        range: [1],
        domain: ['Sales']
      },
      fillOpacity: {
        type: 'ordinal',
        field: '30001',
        range: [1],
        domain: ['Sales']
      }
    },
    state: {
      hover: {
        lineWidth: 2,
        fillOpacity: 1,
        strokeOpacity: 1,
        scaleX: 1,
        scaleY: 1
      }
    }
  },
  line: {
    style: {
      curveType: {
        type: 'ordinal',
        field: '30001',
        range: ['linear'],
        domain: ['Sales']
      },
      lineWidth: {
        type: 'ordinal',
        field: '30001',
        range: [2],
        domain: ['Sales']
      },
      lineDash: {
        type: 'ordinal',
        field: '30001',
        range: [[0, 0]],
        domain: ['Sales']
      }
    }
  },
  area: {
    visible: true,
    style: {
      fillOpacity: 0.35,
      curveType: {
        type: 'ordinal',
        field: '30001',
        range: ['linear'],
        domain: ['Sales']
      }
    },
    state: {
      hover: {
        fillOpacity: 0.8
      }
    }
  },
  // componnet style
  axes: [
    {
      orient: 'radius',
      tick: {
        forceTickCount: 3
      },
      grid: {
        smooth: false,
        style: {
          stroke: 'rgba(255,255,255,0.15)',
          lineWidth: 1
        }
      },
      label: {
        visible: false,
        style: {
          fontFamily: 'D-DIN'
        }
      }
    },
    {
      orient: 'angle',
      sampling: false,
      tick: {
        visible: true,
        style: (...args) => {
          return {
            visible: false
          };
        }
      },
      domainLine: {
        style: {
          visible: false
        }
      },
      grid: {
        style: (label, index) => {
          return {
            stroke: 'rgba(255,255,255,0.15)',
            lineDash: [2, 1],
            lineWidth: 1
          };
        }
      },
      label: {
        style: {
          fontFamily: 'D-DIN',
          fill: 'rgba(255,255,255,0.65)',
          fontSize: 12
        },
        visible: true
      }
    }
  ],
  legends: [
    {
      type: 'discrete',
      visible: true,
      id: 'legend-discrete',
      orient: 'right',
      position: 'middle',
      layoutType: 'normal',
      maxCol: 1,
      title: {
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)'
        }
      },
      layoutLevel: 60,
      item: {
        focus: true,
        focusIconStyle: {
          size: 14
        },
        maxWidth: 0,
        spaceRow: 0,
        spaceCol: 0,
        padding: 0,
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
            symbolType: 'circle',
            fillOpacity: 1,
            size: 12,
            width: 12,
            height: 7.416
          }
        }
      },
      pager: {
        layout: 'horizontal',
        padding: {
          left: -18
        },
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
        top: 0,
        bottom: 0,
        left: 16,
        right: 0
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
  // component style
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
    },
    categoryField: {
      visible: true,
      line: {
        style: {
          stroke: 'rgba(255,255,255,0.15)',
          lineWidth: 2
        }
      }
    },
    valueField: {
      visible: false
    }
  },
  // data
  data: [
    {
      id: 'data',
      values: [
        {
          10001: 'Sales',
          10002: 20,
          10003: 'IAU9APHHM28b',
          30001: 'Sales',
          BHCimAqm0QGN: '河北',
          IAU9APHHM28b: 20
        },
        {
          10001: 'Sales',
          10002: 50,
          10003: 'IAU9APHHM28b',
          30001: 'Sales',
          BHCimAqm0QGN: '山西',
          IAU9APHHM28b: 50
        },
        {
          10001: 'Sales',
          10002: 40,
          10003: 'IAU9APHHM28b',
          30001: 'Sales',
          BHCimAqm0QGN: '内蒙古',
          IAU9APHHM28b: 40
        },
        {
          10001: 'Sales',
          10002: 50,
          10003: 'IAU9APHHM28b',
          30001: 'Sales',
          BHCimAqm0QGN: '辽宁',
          IAU9APHHM28b: 50
        },
        {
          10001: 'Sales',
          10002: 35,
          10003: 'IAU9APHHM28b',
          30001: 'Sales',
          BHCimAqm0QGN: '吉林',
          IAU9APHHM28b: 35
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
          domain: ['Sales'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        BHCimAqm0QGN: {
          alias: 'Province',
          domain: ['河北', '山西', '内蒙古', '辽宁', '吉林'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        IAU9APHHM28b: {
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

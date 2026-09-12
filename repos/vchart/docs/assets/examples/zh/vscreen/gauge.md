---
category: examples
group: vscreen
title: 仪表图
keywords: gauge,comparison,circle
cover: /vchart/preview/vscreen-gauge.png
option: vscreen
---

# 仪表图

大屏场景下的仪表图

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与指针角度字段
- `innerRadius`、`outerRadius` 属性用于指定仪表盘的内外半径
- `startAngle`、`endAngle` 属性用于指定仪表盘的开始、结束角度
- `track` 属性可以配置 gauge 系列的背景

## 代码演示

```javascript livedemo
/** --step1: utils of compute target line position -- */
const radianToDegree = radian => (radian / Math.PI) * 180;
const degreeToRadian = degree => (degree / 180) * Math.PI;
const getLayoutRadius = vchart => {
  const region = vchart.getChart().getRegionsInIndex(0)[0];
  const { width, height } = region.getLayoutRect();
  return Math.min(width / 2, height / 2);
};
const getAngle = (value, min, max, startAngle, endAngle) =>
  degreeToRadian(((value - min) / (max - min)) * (endAngle - startAngle) + startAngle);
const getPos = (radiusRatio, value, minValue, maxValue, startAngle, endAngle, context) => {
  const { vchart } = context;
  const getCenter = () => context.vchart.getChart().getAllSeries()[0].angleAxisHelper.center();

  const layoutRadius = getLayoutRadius(vchart);
  const center = getCenter();
  const angle = getAngle(value, minValue, maxValue, startAngle, endAngle);
  const radius = radiusRatio * layoutRadius;
  const x = center.x + radius * Math.cos(angle);
  const y = center.y + radius * Math.sin(angle);
  return [x, y, angle];
};

/** --step2: construct spec and render chart -- */
const innerRadius = 0.8;
const outerRadius = 0.9;
const startAngle = -180;
const endAngle = 0;
const min = 0;
const max = 500;
const goal = 400;
const spec = {
  type: 'gauge',
  padding: 15,
  categoryField: 'name',
  valueField: 'current',
  startAngle,
  endAngle,
  outerRadius,
  innerRadius,
  data: [
    {
      id: 'data',
      values: [
        {
          current: 341,
          name: 'Profit',
          emptyName: '',
          percent: '-',
          measurePercent: 0.5,
          measureValue: 0.5
        }
      ]
    }
  ],
  axes: [
    {
      visible: true,
      type: 'linear',
      orient: 'angle',
      inside: true,
      min,
      max,
      innerRadius: outerRadius,
      label: {
        visible: true,
        inside: true,
        space: 8,
        style: {
          fill: 'rgba(255,255,255,0.3)',
          fontSize: 12,
          fontFamily: 'D-DIN',
          fontWeight: 'normal'
        },
        autoHideSeparation: 4
      },
      tick: {
        visible: true,
        tickSize: 25,
        style: {
          stroke: 'rgba(255,255,255,0.3)',
          lineWidth: 1
        }
      },
      subTick: {
        visible: false,
        tickSize: 4,
        tickCount: 6,
        style: {
          stroke: 'rgba(255,255,255,0.3)'
        }
      },
      grid: {
        visible: false
      },
      subGrid: {
        visible: false
      },
      ticks: false
    }
  ],
  markPoint: [
    {
      position: {
        x: -20000 + 380,
        y: 20000 + 350
      },
      itemLine: {
        visible: false
      },
      itemContent: {
        type: 'richText',
        autoRotate: false,

        style: {
          width: 40000,
          height: 40000,
          textAlign: 'left',
          textBaseline: 'top',
          type: 'rich',
          textConfig: [
            {
              visible: false,
              text: '\n',
              fontSize: 12,
              fill: '#FFF',
              fontWeight: 'normal',
              fontFamily: 'D-DIN',
              textAlign: 'center',
              textBaseline: 'middle'
            },
            {
              visible: true,
              text: 'Profit',
              fontSize: 16,
              fill: '#FFF',
              fontWeight: 'normal',
              fontFamily: 'D-DIN',
              textAlign: 'center',
              textBaseline: 'middle'
            },
            {
              text: '   ',
              fontSize: 8
            },
            {
              visible: true,
              text: '341.80',
              fontSize: 32,
              fill: '#FFF',
              fontWeight: 'bold',
              fontFamily: 'D-DIN',
              textAlign: 'center',
              textBaseline: 'middle'
            }
          ]
        }
      }
    }
  ],
  extensionMark: [
    {
      type: 'text',
      visible: true,
      zIndex: 9999,
      style: {
        fill: '#fff',
        cornerRadius: 3,
        visible: true,
        text: 'goal:' + goal,
        x: (datum, context) => {
          return getPos(innerRadius - 0.1, goal, min, max, startAngle, endAngle, context)[0];
        },
        y: (datum, context) => {
          return getPos(innerRadius - 0.1, goal, min, max, startAngle, endAngle, context)[1];
        },
        dx: -15
      }
    },
    {
      type: 'rect',
      visible: true,
      zIndex: 0,
      style: {
        fill: '#963824',
        cornerRadius: 3,
        visible: true,
        x: (datum, context) => {
          return getPos(innerRadius - 0.1, goal, min, max, startAngle, endAngle, context)[0];
        },
        y: (datum, context) => {
          return getPos(innerRadius - 0.1, goal, min, max, startAngle, endAngle, context)[1];
        },
        width: 60,
        height: 20,
        dx: -45,
        dy: -15
      }
    },
    {
      type: 'rule',
      visible: true,
      zIndex: 9999,
      style: {
        stroke: '#963824',
        fill: '#963824',
        lineWidth: 2,
        lineCap: 'round',
        x: (datum, context) => {
          return getPos(innerRadius, goal, min, max, startAngle, endAngle, context)[0];
        },
        y: (datum, context) => {
          return getPos(innerRadius, goal, min, max, startAngle, endAngle, context)[1];
        },
        x1: (datum, context) => {
          return getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[0];
        },
        y1: (datum, context) => {
          return getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[1];
        }
      }
    },
    {
      type: 'symbol',
      visible: true,
      zIndex: 9999,
      style: {
        symbolType: 'triangle',
        size: 5,
        stroke: '#963824',
        fill: '#963824',
        lineWidth: 0.5,
        lineCap: 'round',
        x: (datum, context) => {
          return getPos(innerRadius, goal, min, max, startAngle, endAngle, context)[0];
        },
        y: (datum, context) => {
          return getPos(innerRadius, goal, min, max, startAngle, endAngle, context)[1];
        },
        angle: (datum, context) => {
          return radianToDegree(getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[2] + Math.PI / 2);
        }
      }
    },
    {
      type: 'symbol',
      visible: true,
      zIndex: 9999,
      style: {
        symbolType: 'triangle',
        size: 4,
        stroke: '#963824',
        fill: '#963824',
        lineWidth: 0.5,
        lineCap: 'round',
        x: (datum, context) => {
          return getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[0];
        },
        y: (datum, context) => {
          return getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[1];
        },
        x: (datum, context) => {
          return getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[0];
        },
        angle: (datum, context) => {
          return radianToDegree(
            getPos(outerRadius, goal, min, max, startAngle, endAngle, context)[2] + (Math.PI * 3) / 2
          );
        }
      }
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
        spacing: 10,
        shapeLineWidth: 0
      },
      spaceRow: 10
    },
    dimension: {
      visible: true
    }
  },
  background: '#121B24',
  series: [
    {
      type: 'gauge',
      radiusField: 'name',
      angleField: 'current',
      outerRadius: 0.9,
      innerRadius: 0.8,
      track: {
        style: {
          fill: 'rgba(255,255,255,0.1)'
        }
      },
      segment: {
        style: {
          cornerRadius: 0,
          fill: {
            gradient: 'conical',
            x: 0.5,
            y: 0.5,
            startAngle: -3.141592653589793,
            endAngle: 0,
            stops: [
              {
                offset: 0,
                color: 'rgba(0,110,255,0.2)'
              },
              {
                offset: 1,
                color: 'rgb(0,110,255)'
              }
            ]
          },
          boundsMode: 'imprecise'
        }
      },
      padAngle: 0
    },
    {
      type: 'gaugePointer',
      valueField: 'current',
      innerRadius: 0,
      pin: {
        visible: false,
        interactive: false,
        width: 0.025,
        height: 0.025,
        style: {
          fill: 'rgba(230,247,255,0.3)'
        }
      },
      pinBackground: {
        visible: true,
        width: 0.08,
        height: 0.08,
        style: {
          fill: 'rgba(230,247,255,0.3)'
        }
      },
      pointer: {
        visible: true,
        interactive: false,
        zIndex: 9999,
        style: {
          fill: 'rgb(230,247,255)'
        },
        width: 0.4,
        height: 0.3
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

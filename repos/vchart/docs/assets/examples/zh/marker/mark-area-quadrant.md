---
category: examples
group: marker
title: markArea 模拟象限图
keywords: marker,scatterChart,scatter
order: 33-7
cover: /vchart/preview/mark-area-quadrant_1.7.0.png
option: scatterChart#markArea
---

# markArea 模拟象限图

利用 markArea 可以为图表的不同区域配置填充样式, 从而模拟象限图的效果.

## 关键配置

相对位置定位:

- 通过声明 `x`, `y`, `x1`, `y1` 属性来绘制区域，这些属性支持百分比定位

area 样式配置:

- `area.style`属性声明为 area 区域的样式, 支持`fill` `stroke`等图元属性

## 代码演示

```javascript livedemo
const spec = {
  type: 'scatter',
  xField: 'x',
  yField: 'y',
  padding: [12, 12, 50, 50],
  region: [
    {
      style: {
        stroke: '#000',
        lineWidth: 2
      }
    }
  ],
  label: {
    visible: true,
    style: {
      fill: '#222'
    }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      range: {
        min: 140,
        max: 220
      },
      visible: false
    },
    {
      orient: 'left',
      max: 85,
      visible: false
    }
  ],
  markArea: [
    // 第一象限
    {
      x: '50%',
      x1: '100%',
      y: '0%',
      y1: '50%',
      area: {
        style: {
          fill: '#5B8FF9',
          fillOpacity: 0.15
        }
      },
      label: {
        text: '第一象限',
        position: 'insideTop',
        dy: 4,
        labelBackground: {
          style: {
            fill: '#FFC400'
          }
        },
        style: {
          fill: '#fff'
        }
      }
    },
    // 第二象限
    {
      x: '0%',
      x1: '50%',
      y: '0%',
      y1: '50%',
      area: {
        style: {
          fill: '#fff'
        }
      },
      label: {
        text: '第二象限',
        position: 'insideTop',
        dy: 4,
        labelBackground: {
          style: {
            fill: '#FFC400'
          }
        },
        style: {
          fill: '#fff'
        }
      }
    },
    // 第三象限
    {
      x: '0%',
      x1: '50%',
      y: '50%',
      y1: '100%',
      area: {
        style: {
          fill: '#5B8FF9',
          fillOpacity: 0.15
        }
      },
      label: {
        text: '第三象限',
        position: 'insideBottom',
        dy: -4,
        labelBackground: {
          style: {
            fill: '#FFC400'
          }
        },
        style: {
          fill: '#fff'
        }
      }
    },
    // 第四象限
    {
      x: '50%',
      x1: '100%',
      y: '50%',
      y1: '100%',
      area: {
        style: {
          fill: '#fff'
        }
      },
      label: {
        text: '第四象限',
        position: 'insideBottom',
        dy: -4,
        labelBackground: {
          style: {
            fill: '#FFC400'
          }
        },
        style: {
          fill: '#fff'
        }
      }
    }
  ],
  // 分割线
  markLine: [
    // 水平
    {
      x: '50%',
      line: {
        style: {
          lineDash: [0],
          stroke: '#ccc'
        }
      },
      endSymbol: {
        visible: false
      }
    },
    // 垂直
    {
      y: '50%',
      line: {
        style: {
          lineDash: [0],
          stroke: '#ccc'
        }
      },
      endSymbol: {
        visible: false
      }
    },
    // 对角线
    {
      x: '0%',
      y: '100%',
      x1: '100%',
      y1: '0%',
      line: {
        style: {
          lineDash: [0],
          stroke: '#ccc'
        }
      },
      endSymbol: {
        visible: false
      }
    },
    // 对角线
    {
      x: '0%',
      y: '0%',
      x1: '100%',
      y1: '100%',
      line: {
        style: {
          lineDash: [0],
          stroke: '#ccc'
        }
      },
      endSymbol: {
        visible: false
      }
    }
  ],
  // 辅助文本
  extensionMark: [
    // 纵轴辅助文本
    {
      type: 'group',
      visible: true,
      style: {
        x: -12,
        y: (datum, ctx, elements, dataView) => {
          return ctx.getRegion().getLayoutRect().height;
        }
      },
      children: [
        {
          type: 'text',
          visible: true,
          style: {
            x: 0,
            y: 0,
            fontSize: 14,
            lineHeight: 16,
            fill: '#000',
            text: 'ABILITY TO EXECUTE',
            textAlign: 'start',
            textBaseline: 'middle',
            angle: -90
          }
        },
        {
          type: 'rule',
          visible: true,
          style: {
            x: 0,
            y: (datum, ctx, elements, dataView) => {
              return -150;
            },
            x1: 0,
            y1: (datum, ctx, elements, dataView) => {
              return -190;
            },
            stroke: '#000',
            lineWidth: 1
          }
        },
        {
          type: 'symbol',
          visible: true,
          style: {
            x: 0,
            y: (datum, ctx, elements, dataView) => {
              return -186;
            },
            symbolType: 'triangleUp',
            fill: '#000',
            size: 12
          }
        }
      ]
    },
    // 横轴辅助文本
    {
      type: 'group',
      visible: true,
      style: {
        x: 0,
        y: (datum, ctx, elements, dataView) => {
          return ctx.getRegion().getLayoutRect().height + 12;
        }
      },
      children: [
        {
          type: 'text',
          visible: true,
          style: {
            x: 0,
            y: 0,
            fontSize: 14,
            lineHeight: 16,
            fill: '#000',
            text: 'COMPLETENESS OF VISION',
            textAlign: 'start',
            textBaseline: 'middle'
          }
        },
        {
          type: 'rule',
          visible: true,
          style: {
            x: 190,
            y: 0,
            x1: 230,
            y1: 0,
            stroke: '#000',
            lineWidth: 1
          }
        },
        {
          type: 'symbol',
          visible: true,
          style: {
            x: 236,
            y: 0,
            symbolType: 'triangleRight',
            fill: '#000',
            size: 12
          }
        }
      ]
    }
  ],
  data: {
    id: 'data2',
    values: [
      {
        name: 'Denmark',
        x: 201.53,
        y: 26.84
      },
      {
        name: 'Switzerland',
        x: 196.44,
        y: 21.73
      },
      {
        name: 'Australia',
        x: 196.4,
        y: 24.09
      },
      {
        name: 'New Zealand',
        x: 196.09,
        y: 19.43,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Germany',
        x: 189.87,
        y: 27.68
      },
      {
        name: 'Austria',
        x: 187,
        y: 25.43
      },
      {
        name: 'Netherlands',
        x: 186.46,
        y: 29.08,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Spain',
        x: 184.69,
        y: 40.37,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Finland',
        x: 183.98,
        y: 14.57
      },
      {
        name: 'United States',
        x: 181.91,
        y: 32.73,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Portugal',
        x: 180.66,
        y: 29.87
      },
      {
        name: 'Sweden',
        x: 177.93,
        y: 16.59
      },
      {
        name: 'United Kingdom',
        x: 177.73,
        y: 34.24
      },
      {
        name: 'Norway',
        x: 176.23,
        y: 19.28,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Canada',
        x: 172.83,
        y: 28.17,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Japan',
        x: 172.72,
        y: 40.9
      },
      {
        name: 'France',
        x: 172.3,
        y: 42.04,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Estonia',
        x: 171.71,
        y: 19.19
      },
      {
        name: 'Ireland',
        x: 170.83,
        y: 27.47
      },
      {
        name: 'Czech Republic',
        x: 167.77,
        y: 42.17
      },
      {
        name: 'South Korea',
        x: 167.52,
        y: 50.28,
        label: {
          anchor: 'left'
        }
      },
      {
        name: 'Croatia',
        x: 167.51,
        y: 30.69
      },
      {
        name: 'Belgium',
        x: 162.57,
        y: 50.46,
        label: {
          anchor: 'top',
          offsetX: 0,
          offsetY: 3
        }
      },
      {
        name: 'Israel',
        x: 160.72,
        y: 61.91
      },
      {
        name: 'Italy',
        x: 160.21,
        y: 52.96
      },
      {
        name: 'Saudi Arabia',
        x: 156.98,
        y: 72.12
      },
      {
        name: 'Greece',
        x: 156.8,
        y: 49.1
      },
      {
        name: 'Slovakia',
        x: 154.13,
        y: 44.28
      },
      {
        name: 'Taiwan',
        x: 150.62,
        y: 64.3
      },
      {
        name: 'Poland',
        x: 150.13,
        y: 50.79
      }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)

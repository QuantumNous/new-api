---
category: demo
group: axis
title: 通用样式配置
keywords: lineChart,comparison,trend,line,axis
order: 25-1
cover: /vchart/preview/axis-style_1.13.1.png
option: lineChart#axes
---

# 通用样式配置

在该示例中我们通过 `axes` 上提供的配置项进行坐标轴样式的配置，同时通过配置我们可以绘制多条坐标轴。

## 关键配置

对于直角坐标系下的坐标轴，我们提供了 `left` `right` `top` `bottom` 四个方向的配置，默认 Y 轴显示在左侧，X 轴显示在底部。我们可以通过在 `axes` 属性同添加上对应方向的配置来控制各个方向上的坐标轴展示，如：`{ orient: 'top' }`

对于坐标轴的样式配置，分别通过：

- `domainLine` 坐标轴线配置
- `label` 坐标轴标签配置
- `tick` 坐标轴刻度线配置
- `grid` 坐标轴网格线配置
- `title` 坐标轴标题配置
- `unit` 坐标轴单位配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  theme: {
    fontFamily: 'serif' // Configure global fonts
  },
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'right',
      title: {
        visible: true,
        space: 12,
        text: 'Right axis title'
      },
      label: {
        formatMethod: val => `${val}°C`,
        style: {
          fill: '#000'
        }
      },
      unit: {
        visible: true,
        text: 'Unit of right axis',
        style: {
          // dx: -18,
          dy: -8
          // textAlign: 'right'
        }
      },
      tick: {
        visible: true,
        tickStep: 2,
        tickSize: 6,
        style: {
          stroke: '#000'
        }
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: false
      }
    },
    {
      orient: 'left',
      title: {
        visible: true,
        space: 12,
        text: 'Left axis title'
      },
      unit: {
        visible: true,
        text: 'Unit of left axis',
        style: {
          // dx: -18,
          dy: -8
          // textAlign: 'right'
        }
      },
      label: {
        formatMethod: val => `${val}°C`,
        style: {
          fill: '#000'
        }
      },
      tick: {
        visible: true,
        tickStep: 2,
        tickSize: 6,
        style: {
          stroke: '#000'
        }
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'top',
      label: {
        style: {
          fill: '#000'
        }
      },

      tick: {
        inside: true,
        tickSize: 8,
        style: {
          stroke: '#000'
        }
      },
      domainLine: {
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'bottom',
      label: {
        inside: true,
        style: {
          fill: '#000'
        }
      },
      domainLine: {
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: false
      },
      tick: {
        inside: true,
        tickSize: 8,
        style: {
          stroke: '#000'
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

附上和该 demo 配置相关联的教程或者 api 文档的链接。

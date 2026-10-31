---
category: examples
group: bar chart
title: 柱状图标注
keywords: barChart,comparison,distribution,rectangle,markPoint
cover: /vchart/preview/bar-markPoint_1.5.0.png
option: barChart
---

# 带自定义标注的柱状图

在柱状图可以使用 `markPoint` 对柱子进行数据标注。

## 关键配置

- `axes` 属性中为位于 `bottom` 位置的坐标轴轴线开启配置 `grid.alignWithLabel`，配置为 false 使显示在前后两个刻度中间。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { time: '10:20', cost: 2 },
        { time: '10:30', cost: 1 },
        { time: '10:40', cost: 1 },
        { time: '10:50', cost: 2 },
        { time: '11:00', cost: 2 },
        { time: '11:10', cost: 2 },
        { time: '11:20', cost: 1 },
        { time: '11:30', cost: 1 },
        { time: '11:40', cost: 2 },
        { time: '11:50', cost: 1 }
      ]
    }
  ],
  xField: 'time',
  yField: 'cost',
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'rect',
        style: {
          fill: 'rgb(85,208,93)',
          fillOpacity: 0.1
        }
      },
      bindingAxesIndex: [1],
      defaultSelect: {
        axisIndex: 1,
        datum: '10:20'
      }
    }
  },
  label: {
    visible: true,
    animation: false,
    formatMethod: datum => `${datum}分钟`,
    style: {
      fill: 'rgb(155,155,155)'
    }
  },
  bar: {
    style: {
      fill: 'rgb(85,208,93)',
      cornerRadius: [4, 4, 0, 0],
      width: 30
    }
  },
  markPoint: [
    {
      coordinate: {
        time: '10:20',
        cost: 2
      },
      itemContent: {
        type: 'text',
        autoRotate: false,
        offsetY: -10,
        text: {
          labelBackground: {
            padding: [5, 10, 5, 10],
            style: {
              fill: '#000',
              cornerRadius: 5
            }
          }
        },
        style: {
          dy: 14,
          text: '2分钟',
          fill: 'white',
          fontSize: 14
        }
      },
      itemLine: {
        endSymbol: {
          visible: true,
          style: {
            angle: Math.PI,
            scaleY: 0.4,
            fill: '#000',
            dy: 4,
            stroke: '#000'
          }
        },
        startSymbol: { visible: false },
        line: {
          style: {
            visible: false
          }
        }
      }
    }
  ],
  animationUpdate: false,
  axes: [
    {
      orient: 'left',
      max: 10,
      label: { visible: false },
      grid: {
        style: { lineDash: [4, 4] }
      }
    },
    {
      orient: 'bottom',
      label: {
        formatMethod: datum => {
          return datum === '10:20' ? '当前' : datum;
        },
        style: (datum, a, b) => {
          return {
            fontSize: datum === '10:20' ? 14 : 12,
            fill: datum === '10:20' ? 'black' : 'grey'
          };
        }
      },
      paddingOuter: 0.5,
      paddingInner: 0,
      grid: {
        visible: true,
        alignWithLabel: false,
        style: { lineDash: [4, 4] }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

## 相关教程

[柱状图](link)

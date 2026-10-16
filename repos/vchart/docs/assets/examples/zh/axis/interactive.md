---
category: demo
group: axis
title: 坐标轴交互
keywords: areaChart,comparison,composition,trend,area,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/interactive.png
option: areaChart#axes
---

# 坐标轴交互

这个例子我们通过开启坐标轴的 `select` 和 `hover` 属性来开启坐标轴的交互功能。通过坐标轴背景区域意义标签的样式变化，来展示在不同交互状态下的响应。

## 关键配置

在 `axes` 属性上为指定方向的坐标轴配置：

- `select` 属性设置为 true，用于开启坐标轴选中交互
- `hover` 属性设置为 true，用于开启坐标轴 hover 交互
- `background` 属性，用于坐标轴背景设置，
  - `background.visible` 开启背景渲染
  - `background.style` 配置背景样式
  - `background.state` 配置背景在 hover 和 select 交互状态下的样式
- `label` 属性用于配置坐标轴标签
  - `label.state` 配置背景在 hover 和 select 交互状态下的样式

## 代码演示

```javascript livedemo
const axisConfig = {
  hover: true, // enable hover
  select: true, // enable select
  background: {
    visible: true,
    style: {
      fillOpacity: 0
    },
    state: {
      hover: {
        fillOpacity: 0.65,
        fill: '#DDE3E9',
        cursor: 'pointer'
      },
      selected: {
        fillOpacity: 0.65,
        fill: '#9CCBDB',
        cursor: 'pointer'
      }
    }
  },
  label: {
    style: {
      pickable: false // In order not to affect the picking of the background, first turn off the picking of the label, that is, do not respond to events
    },
    state: {
      hover_reverse: {
        fill: '#444'
      },
      selected_reverse: {
        fill: '#444'
      }
    }
  }
};

const spec = {
  type: 'area',
  data: [
    {
      id: 'area',
      values: [
        {
          x: '1990',
          y: 110,
          from: 'vedio ad'
        },
        {
          x: '1995',
          y: 160,
          from: 'vedio ad'
        },
        {
          x: '2000',
          y: 230,
          from: 'vedio ad'
        },
        {
          x: '2005',
          y: 300,
          from: 'vedio ad'
        },
        {
          x: '2010',
          y: 448,
          from: 'vedio ad'
        },
        {
          x: '2015',
          y: 500,
          from: 'vedio ad'
        },
        {
          x: '1990',
          y: 120,
          from: 'email marketing'
        },
        {
          x: '1995',
          y: 150,
          from: 'email marketing'
        },
        {
          x: '2000',
          y: 200,
          from: 'email marketing'
        },
        {
          x: '2005',
          y: 210,
          from: 'email marketing'
        },
        {
          x: '2010',
          y: 300,
          from: 'email marketing'
        },
        {
          x: '2015',
          y: 320,
          from: 'email marketing'
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'from',
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  area: {
    style: {
      fillOpacity: 1,
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            opacity: 0.2
          },
          {
            offset: 1,
            opacity: 0
          }
        ]
      }
    }
  },
  axes: [
    {
      orient: 'bottom',
      ...axisConfig
    },
    {
      orient: 'left',
      ...axisConfig
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

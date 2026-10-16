# 在 pc 端上鼠标悬浮在数据点上出现的 tooltip 这种效果，在小程序上有类似这样手指触碰屏幕提示数据点位置的 api 吗？

## 问题描述

想问一下，在 pc 端上鼠标悬浮在数据点上出现的 tooltip 这种效果，在飞书小程序上有类似这样手指触碰屏幕提示数据点位置的 api 吗？类似下图这样的：

![](/vchart/faq/94-0.png)

补充下，我是使用的 Taro 框架。

## 解决方案

首先这个十字线的效果在图表库中一般叫做 crosshair 十字辅助线，目前 VChart 是直接支持的，只需要在图表上配置 crosshair 就可以。

另外 VChart 也提供了基于 Taro 封装了对应的图表组件，你可以直接使用该组件：`@visactor/taro-vchart`。

下面是配置了 crosshair 之后的图表在飞书小程序上的表现：

![](94-1.gif)

## 代码示例

```ts
{
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A' },
        { x: 'Round 6', y: 72, c: 'Role B' },
        { x: 'Round 7', y: 38, c: 'Role A' },
        { x: 'Round 7', y: 65, c: 'Role B' },
        { x: 'Round 8', y: 24, c: 'Role A' },
        { x: 'Round 8', y: 70, c: 'Role B' },
        { x: 'Round 9', y: 28, c: 'Role A' },
        { x: 'Round 9', y: 62, c: 'Role B' }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      max: 100
    },
    {
      orient: 'bottom'
    },
    {
      orient: 'right',
      max: 100
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  point: {
    style: {
      size: 5
    },
    state: {
      dimension_hover: {
        size: 10
      }
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line', // Defaults is `rect`
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true // label is off by default
      }
    },
    yField: {
      visible: true,
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true // label is off by default
      }
    }
  }
}
```

## 相关文档

[Crosshair 教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Crosshair)
[Crosshair 配置](https://www.visactor.io/vchart/option/barChart#crosshair)
[Taro 使用教程](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/taro)

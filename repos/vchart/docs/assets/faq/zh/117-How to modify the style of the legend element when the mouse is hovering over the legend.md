# 如何实现当鼠标悬浮于图例上时 圆形的图例扩大一圈高亮显示 并且去掉长方形的灰色的背景？

## 问题描述

怎么配置图例在鼠标悬浮时的样式，期望可以用图形变大替换灰色背景。

## 解决方案

VChart 的图例提供了图形在被鼠标悬浮时的样式配置，背景也可以关闭的配置

1. item.background.visible 可以用来关闭或者开启图例项的背景
2. item.shape.state.selectedHover 可以用来设置选中图形被鼠标悬浮时的样式
3. item.shape.state.unSelectedHover 可以用来设置选中图形被鼠标悬浮时的样式

VChart 的图形样式配置属性是保持了统一的，在 selectedHover 和 unSelectedHover 里同时配置 size 就可以保证所有的图例项在被鼠标悬浮时点变大。

## 代码示例

```javascript livedemo
const spec = {
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
    orient: 'bottom',
    item: {
      background: {
        visible: false
      },
      shape: {
        state: {
          selectedHover: {
            size: 15
          },
          unSelectedHover: {
            size: 15
          }
        }
      }
    }
  },
  xField: 'x',
  yField: 'y',
  seriesField: 'c'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [图例项背景配置](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.background.visible)
- [图例项悬浮配置](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.shape.state.selectedHover)

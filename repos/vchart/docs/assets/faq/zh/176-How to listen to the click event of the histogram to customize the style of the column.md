# 如何监听柱状图的点击事件来自定义柱子的样式？

## 问题描述

我想在一个柱状图里头监听每个柱子的点击事件，如果柱子被点击了就画成不同的颜色，大概像这样：

![bar](/vchart/faq/78-0.png)

但是点击事件触发之后我不希望重新渲染整个图表，最好能够在当前图表的基础上有一个平滑过度的效果，这个应该怎么实现呢？

## 解决方案

VChart 对于每个图表的图元提供了内置的 hover 和 select 状态。开发者不需要自己监听柱子的点击事件，只需要在相应的图元配置中声明 select 状态下的样式就可以实现柱子被选中后渲染为不同颜色的效果。

同时 VChart 柱状图中默认对柱子图元的视觉通道变更开启了更新动画，当颜色发生变更时，柱子的渲染效果将会平滑过渡到最终状态。

## 代码示例

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar: {
    state: {
      selected: {
        fill: 'red'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [barChart bar state spec](https://www.visactor.io/vchart/option/barChart#bar.state)

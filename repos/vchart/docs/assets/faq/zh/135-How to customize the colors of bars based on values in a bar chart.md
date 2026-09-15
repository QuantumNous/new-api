# 柱状图如何根据不同的数值自定义柱子的颜色？

## 问题描述

我需要绘制一个能够根据不同柱子的数值配置不同颜色的柱状图，请问应该如何实现？

## 解决方案

可以使用 VChart 中配置柱子样式的回调来根据数据内容自定义颜色。

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
    style: {
      fill: datum => {
        return datum.sales > 25 ? 'red' : 'blue';
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
- [barChart style spec](https://www.visactor.io/vchart/option/barChart#bar.style.fill)

# 如何实现图表 tooltip 常驻显示？

## 问题描述

VChart 如何配置 tooltip 永久显示，如下图：

![tooltip](/vchart/faq/70-0.png)

## 解决方案

VChart 目前无法同时保留两个 tooltip，但是 tooltip 支持常驻显示，通过将 `triggerOff` 配置为 `none`。可以参照以下 demo：

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
  tooltip: {
    trigger: 'click',
    triggerOff: 'none',
    mark: {
      position: 'top'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

![demo](/vchart/faq/70-1.png)

## 相关文档

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

option docs: [https://www.visactor.io/vchart/option/barChart#tooltip.visible](https://www.visactor.io/vchart/option/barChart#tooltip.visible)

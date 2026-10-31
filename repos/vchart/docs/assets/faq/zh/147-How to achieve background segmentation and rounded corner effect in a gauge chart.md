# 如何实现仪表图的分段圆角效果？

## 问题描述

我在 vchart 官网上看到了这个 demo：[https://www.visactor.io/vchart/demo/gauge-chart/clock](https://www.visactor.io/vchart/demo/gauge-chart/clock)

它看起来像是仪表图的变种。现在我需要将常规仪表图的背景更改为类似的样式，将背景分段并设置圆角。我该怎么办？

## 解决方案

可以参照以下 demo，用另一套数据去定义背景分段，并将背景系列（spec 的对应属性名是“gauge”）改为“gauge”系列。

## 代码示例

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'level1',
          value: 0.4
        },
        {
          type: 'level2',
          value: 0.6
        },
        {
          type: 'level3',
          value: 0.8
        }
      ]
    }
  ],
  gauge: {
    type: 'gauge',
    dataIndex: 1,
    categoryField: 'type',
    valueField: 'value',
    seriesField: 'type',
    segment: {
      style: {
        cornerRadius: 10
      }
    }
  },
  pointer: {
    style: {
      fill: '#666666'
    }
  },
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.5,
  startAngle: -180,
  endAngle: 0,
  axes: [{ type: 'linear', orient: 'angle', grid: { visible: false } }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

![demo](/vchart/faq/65-0.png)

## 相关文档

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

gauge series spec: [https://www.visactor.io/vchart/option/gaugeChart#gauge%EF%BC%88gauge%20%E7%B3%BB%E5%88%97%E7%89%88%E6%9C%AC%EF%BC%89.type('gauge')](<https://www.visactor.io/vchart/option/gaugeChart#gauge%EF%BC%88gauge%20%E7%B3%BB%E5%88%97%E7%89%88%E6%9C%AC%EF%BC%89.type('gauge')>)

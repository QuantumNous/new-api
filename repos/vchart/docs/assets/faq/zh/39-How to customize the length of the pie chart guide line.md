# 如何自定义饼图引导线的长度？

## 问题描述

一般的饼图展示标签的时候都会额外绘制一个引导线用来连接扇区和对应的标签（类似 https://echarts.apache.org/examples/zh/editor.html?c=pie-simple），但是几个图表库常见的引导线逻辑都没有提供配置。如果我需要自定义这个引导线的长度应该怎么做呢？

![pie](/vchart/faq/80-0.png)

## 解决方案

VChart 内置提供了饼图标签的布局算法，并且允许开发者自定义布局计算中的一些关键配置项。开发者可以通过饼图标签的 `label.line.line1MinLength` 以及 `label.line.line2MinLength` 配置项设置两段引导线的最小长度。

VChart 饼图标签布局算法可以参考这篇文章：https://zhuanlan.zhihu.com/p/179166155

## 代码示例

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.6,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    line: {
      line1MinLength: 30,
      line2MinLength: 10
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
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
- [Pie label spec](https://visactor.io/vchart/option/pieChart#label.line.line1MinLength)

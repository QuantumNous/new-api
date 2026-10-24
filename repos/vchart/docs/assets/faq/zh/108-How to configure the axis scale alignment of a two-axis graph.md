# 47.如何配置双轴图的坐标轴刻度对齐？

## 问题描述

我在使用 VChart 图表时，请问下这两条横坐标左右的数据可以配置对齐吗？效果相当于两条坐标轴重叠。

![tooltip](/vchart/faq/47-0.png)

## 解决方案

VChart 中提供了这样的配置，如果你需要同步轴的范围使 0 值对齐，可以参考文档中的配置：[https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId](https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId)

通过 sync 指定右轴向左轴对齐即可。需要注意的是：需要为左轴定义 id，以便能够在其他轴中指定它。

## 代码示例

```javascript
spec.axes = [
  {
    orient: 'left',
    id: 'left_axis',
    seriesIndex: [0]
  },
  {
    orient: 'right',
    seriesId: ['line'],
    grid: {
      visible: false
    },
    sync: {
      axisId: 'left_axis',
      zeroAlign: true
    }
  }
];
```

## 结果展示

![demo](/vchart/faq/47-1.png)

Demo: [https://codesandbox.io/s/dual-axis-zero-align-9y49w3?file=/src/index.ts](https://codesandbox.io/s/dual-axis-zero-align-9y49w3?file=/src/index.ts)

## 相关文档

Axis option: [https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId](https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

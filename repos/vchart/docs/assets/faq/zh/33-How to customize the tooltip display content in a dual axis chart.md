# 双轴图中如何自定义 Tooltip 显示内容？

## 问题描述

我正在使用 VChart，如下图所示，我应该如何在 dimension tooltip 中隐藏柱状图系列的信息，只显示折线图系列的信息？

![tooltip](/vchart/faq/72-0.png)

## 解决方案

VChart 的 tooltip 不仅可以在图表层级配置，在系列层级上也可以。在柱状图对应系列的 spec 中将 dimension tooltip 关掉即可。如以下 demo：

## 代码示例

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      tooltip: {
        dimension: {
          visible: false
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: 0 },
    { orient: 'right', seriesIndex: 1 },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

![demo](/vchart/faq/72-1.png)

## 相关文档

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

option docs: [https://www.visactor.io/vchart/option/barChart#tooltip.dimension.visible](https://www.visactor.io/vchart/option/barChart#tooltip.dimension.visible)

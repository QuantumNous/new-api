---
category: demo
group: axis
title: 固定组宽并自动出现滚动条
keywords: areaChart,axis,scrollBar
order: 25-16
cover: /vchart/preview/axis-band-size_1.4.0.png
option: barChart#axes
---

# 固定组宽并自动出现滚动条

有时我们有固定离散轴的组宽的需求（组宽为坐标轴上一个 tick 所占的宽度）。在视觉表现上是这样的效果：不管图表容器大小如何变化，轴上 tick 和 tick 之间的距离保持不变（如果是柱状图，则柱宽也保持不变）。

## 关键配置

在笛卡尔坐标系下，如果想固定离散轴的组宽，可以通过在轴上配置 `bandSize` 来人为设置组宽。

进一步地，如果想配置最大或最小组宽，可以通过在轴上配置 `maxBandSize` 或 `minBandSize` 来实现。

以最小组宽为例，由于图表会在容器中默认等比例展示全部的 tick，那么当图表容器变小时，自动计算的组宽也会等比例缩小。当自动计算的组宽小于 `minBandSize` 时，组宽将维持 `minBandSize` 的值。

当已经配置 `bandSize` 时，`maxBandSize` 和 `minBandSize` 将不再生效。

另外，如果组宽被固定，图表大小很可能会超出容器。这时可以配置 scrollBar 或者 dataZoom 组件，并在组件 spec 中将 `auto` 配置为 `true`。

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  crosshair: {
    xField: { visible: true, label: { visible: true } },
    yField: { visible: true, label: { visible: true } }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      bandSize: 100
    },
    { orient: 'left', type: 'linear' }
  ],
  scrollBar: [
    {
      orient: 'bottom',
      start: 0,
      filterMode: 'axis',
      axisIndex: 0,
      auto: true
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

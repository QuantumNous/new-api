---
category: demo
group: axis
title: 纵排轴标签
keywords: barChart,axis
order: 25-17
cover: /vchart/preview/axis-vertical-label_1.4.0.png
option: barChart#axes
---

# 纵排轴标签

通过为 `label.style` 配置 `direction: 'vertical'`，我们可以实现轴标签的纵排显示

## 关键配置

为对应方向的轴标签配置样式： `label: { style: { direction: 'vertical' } }`

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: {
    values: [
      { type: '指甲油 Nail polish', country: 'Africa', value: 4229 },
      { type: '指甲油 Nail polish', country: 'EU', value: 4376 },
      { type: '指甲油 Nail polish', country: 'China', value: 3054 },
      { type: '指甲油 Nail polish', country: 'USA', value: 12814 },
      { type: '眉笔 Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: '眉笔 Eyebrow pencil', country: 'EU', value: 3987 },
      { type: '眉笔 Eyebrow pencil', country: 'China', value: 5067 },
      { type: '眉笔 Eyebrow pencil', country: 'USA', value: 13012 },
      { type: '胭脂 Rouge', country: 'Africa', value: 5221 },
      { type: '胭脂 Rouge', country: 'EU', value: 3574 },
      { type: '胭脂 Rouge', country: 'China', value: 7004 },
      { type: '胭脂 Rouge', country: 'USA', value: 11624 },
      { type: '口红 Lipstick', country: 'Africa', value: 9256 },
      { type: '口红 Lipstick', country: 'EU', value: 4376 },
      { type: '口红 Lipstick', country: 'China', value: 9054 },
      { type: '口红 Lipstick', country: 'USA', value: 8814 },
      { type: '眼影 Eyeshadows', country: 'Africa', value: 3308 },
      { type: '眼影 Eyeshadows', country: 'EU', value: 4572 },
      { type: '眼影 Eyeshadows', country: 'China', value: 12043 },
      { type: '眼影 Eyeshadows', country: 'USA', value: 12998 },
      { type: '眼线笔 Eyeliner', country: 'Africa', value: 5432 },
      { type: '眼线笔 Eyeliner', country: 'EU', value: 3417 },
      { type: '眼线笔 Eyeliner', country: 'China', value: 15067 },
      { type: '眼线笔 Eyeliner', country: 'USA', value: 12321 },
      { type: '粉底 Foundation', country: 'Africa', value: 13701 },
      { type: '粉底 Foundation', country: 'EU', value: 5231 },
      { type: '粉底 Foundation', country: 'China', value: 10119 },
      { type: '粉底 Foundation', country: 'USA', value: 10342 },
      { type: '唇彩 Lip gloss', country: 'Africa', value: 4008 },
      { type: '唇彩 Lip gloss', country: 'EU', value: 4572 },
      { type: '唇彩 Lip gloss', country: 'China', value: 12043 },
      { type: '唇彩 Lip gloss', country: 'USA', value: 22998 },
      { type: '睫毛膏 Mascara', country: 'Africa', value: 18712 },
      { type: '睫毛膏 Mascara', country: 'EU', value: 6134 },
      { type: '睫毛膏 Mascara', country: 'China', value: 10419 },
      { type: '睫毛膏 Mascara', country: 'USA', value: 11261 }
    ]
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: { visible: true },
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      sampling: false,
      label: {
        style: {
          direction: 'vertical'
        }
      }
    },
    { orient: 'left', type: 'linear' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。

---
category: examples
group: customMark
title: 条形图image填充
order: 40-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/bar-image-fill.png
option: barChart#extensionMark
---

# 条形图 image 填充

## 关键配置

- `extensionMark` 属性配置自定义 image 图元
  - `extensionMark.type` 属性配置图元的类型
  - `extensionMark.dataId` 属性配置图元的数据来源
  - `extensionMark.style` 属性配置图元的样式

## 代码演示

```javascript livedemo
const icons = {
  口红: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/demo/%E5%8F%A3%E7%BA%A2.png',
  吹风机: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/demo/%E5%90%B9%E9%A3%8E%E6%9C%BA.png',
  化妆刷: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/demo/%E5%8C%96%E5%A6%86%E5%88%B7.png',
  洗面仪: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/demo/%E6%B4%97%E9%9D%A2%E4%BB%AA.png',
  手套: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/demo/%E6%89%8B%E5%A5%97.png'
};

const spec = {
  height: 400,
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: [
        { type: '口红', value: 900 },
        { type: '吹风机', value: 613 },
        { type: '化妆刷', value: 329 },
        { type: '洗面仪', value: 500 },
        { type: '手套', value: 400 }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  bar: {
    style: {
      fill: '#e8e8e8'
    }
  },
  label: {
    visible: true,
    style: {
      fill: '#000'
    }
  },

  extensionMark: [
    {
      type: 'image',
      dataId: 'id0',
      visible: true,
      zIndex: 10000,
      style: {
        opacity: 0.1,
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]);
        },
        width: (datum, ctx, elements, dataView) => {
          const rect = ctx.getRegion().getBoundsInRect();

          return rect.x2 - rect.x1;
        },
        height: (datum, ctx, elements, dataView) => {
          return ctx.yBandwidth();
        },
        image: datum => {
          return icons[datum.type];
        },
        repeatX: 'repeat',
        repeatY: 'repeat'
      }
    },
    {
      type: 'image',
      dataId: 'id0',
      visible: true,
      zIndex: 10000,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]);
        },
        width: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([datum.value]);
        },
        height: (datum, ctx, elements, dataView) => {
          return ctx.yBandwidth();
        },
        image: datum => {
          return icons[datum.type];
        },
        repeatX: 'repeat',
        repeatY: 'repeat'
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[自定义 mark](link)

---
category: examples
group: pattern
title: 带纹理的分组柱状图
keywords: barChart,comparison,distribution,rank,pattern,label,rectangle
order: 41-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pattern/accessible-column.png
option: barChart
---

# 带纹理的分组柱状图

通过纹理来填充图表，在一些屏幕亮度比较低或者面向色弱色盲人群的场景下，可以提高图表的可读性。

## 关键配置

- 在图元上配置纹理属性，`texture`，支持：`'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`。
- 通过 `scales` 属性自定义映射：
  - `id` 定义 scale 的唯一标识，
  - `type` 定义 scale 的类型，
  - `domain` 定义 scale 的输入域，这里绑定了数据源以及对应的字段，`{ dataId: string, fields: string[] }`
  - `range` 定义 scale 的输出域，这里为纹理的类型
- 在图元的 `texture` 属性上绑定映射的数据字段以及 scale 类型
  - `field` 定义映射的数据字段
  - `scale` 配置在 scales 属性上定义的 scale 的 id

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        { company: 'Apple', type: 'Total', value: 30 },
        { company: 'Facebook', type: 'Total', value: 35 },
        { company: 'Google', type: 'Total', value: 28 },
        { company: 'Apple', type: 'Non-technical', value: 40 },
        { company: 'Facebook', type: 'Non-technical', value: 65 },
        { company: 'Google', type: 'Non-technical', value: 47 },
        { company: 'Apple', type: 'Technical', value: 23 },
        { company: 'Facebook', type: 'Technical', value: 18 },
        { company: 'Google', type: 'Technical', value: 20 }
      ]
    }
  ],
  xField: ['type', 'company'],
  yField: 'value',
  seriesField: 'company',
  bar: {
    style: {
      texture: {
        field: 'company',
        scale: 'texture'
      }
    }
  },
  scales: [
    {
      id: 'texture',
      type: 'ordinal',
      domain: [
        {
          dataId: 'data',
          fields: ['company']
        }
      ],
      range: ['bias-lr', 'rect', 'grid']
    }
  ],
  label: {
    visible: true,
    style: {
      fill: '#000'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## 相关教程

[散点图](link)

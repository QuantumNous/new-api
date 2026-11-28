---
category: examples
group: pie
title: 线性渐变颜色饼图
keywords: pieChart,comparison,composition,proportion,circle
order: 6-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pie-chart/linear-color-pie.png
option: pieChart
---

# 线性渐变颜色饼图

通过 `color` 属性配置 linear 类型的 scale 来实现扇形的颜色渐变，同时通过 legend 的自定义 data 来图例项 shape 的颜色同扇形颜色保持一致。

## 关键配置

- `color` 定义 linear 类型的 scale
- `pie.style.fill` 进行颜色映射，根据 `value` 字段值进行映射
- `legends.data` 来自定义 data 来图例项 shape 的颜色同扇形颜色保持一致

## 代码演示

```javascript livedemo
const pieData = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: pieData
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  color: {
    id: 'color',
    type: 'linear',
    range: ['#1664FF', '#B2CFFF', '#1AC6FF', '#94EFFF'],
    domain: [
      {
        dataId: 'id0',
        fields: ['value']
      }
    ]
  },
  pie: {
    style: {
      cornerRadius: 10,
      fill: {
        scale: 'color',
        field: 'value'
      }
    }
  },
  legends: {
    visible: true,
    orient: 'left',
    data: (data, scale) => {
      return data.map(datum => {
        const pickDatum = pieData.find(pieDatum => pieDatum.type === datum.label);

        datum.shape.fill = scale?.scale?.(pickDatum?.value);
        return datum;
      });
    }
  },
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)

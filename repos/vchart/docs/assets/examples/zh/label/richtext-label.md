---
category: examples
group: label
title: 柱状图富文本标签
keywords: label,richtext
cover: /vchart/preview/label-richtext-1.10.0.png
option: barChart#label
---

# 富文本标签

使用富文本标签可以灵活的展示灵活样式的文本、图片标签。

## 关键配置

- `label`: 标签配置。
  - `visible`: 显示标签。
  - `formatMethod`: 标签格式化配置，其返回值中：
    - `type`字段为 'rich'，表示使用富文本标签；
    - `text`字段为[富文本文字配置](/vchart/option/barChart#title.textStyle.character)。

## 代码演示

```javascript livedemo
const iconUrl = week => `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/${week}-icon-vchart-demo.svg`;
const iconMap = {
  Monday: iconUrl('Monday'),
  Tuesday: iconUrl('Tuesday'),
  Wednesday: iconUrl('Wednesday'),
  Thursday: iconUrl('Thursday'),
  Friday: iconUrl('Friday')
};

const spec = {
  type: 'bar',
  width: 835,
  height: 520,
  data: [
    {
      id: 'barData',
      values: [
        { day: 'Monday', sales: 22 },
        { day: 'Tuesday', sales: 13 },
        { day: 'Wednesday', sales: 25 },
        { day: 'Thursday', sales: 29 },
        { day: 'Friday', sales: 38 }
      ]
    }
  ],
  label: {
    visible: true,
    position: 'top',
    interactive: true,
    id: 'label',
    formatMethod: (value, data) => {
      return {
        type: 'rich',
        text: [
          {
            image: iconMap[data.day],
            width: 18,
            height: 18
          },
          {
            text: ` ${data.day}`,
            fontSize: 12,
            underline: true
          },
          {
            text: `: `,
            fontSize: 12
          },
          {
            text: `${value} `,
            fontSize: 14,
            fontStyle: 'italic',
            fill: 'black',
            fontWeight: 'bold'
          }
        ]
      };
    }
  },
  xField: 'day',
  yField: 'sales',
  seriesField: 'day'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[散点图](link)

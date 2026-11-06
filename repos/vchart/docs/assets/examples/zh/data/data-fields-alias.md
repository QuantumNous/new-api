---
category: demo
group: data
title: 数据别名
keywords: data,alias
order: 34-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/data-fields-alias.png
option: lineChart#data
---

# 数据别名

数据的 `fields` 配置支持对维度进行处理，其中配置 `sortIndex` 可以对数据进行排序，配置 `sortReverse` 为 `true` 可以在排序时逆序。默认不逆序的情况下：连续数从小到大。离散数据按照 `domain` 从前到后。

## 关键配置

- `sortIndex` 在 `data` 的 `fields` 中配置。可以将数据按照此维度排序
- `sortReverse` 排序时是否逆序。

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: {
        temperature: {
          alias: 'temperature'
        },
        date: {
          alias: 'date'
        },
        type: {
          alias: 'type'
        }
      },
      values: [
        {
          date: 'Monday',
          temperature: 18,
          type: 'lowest'
        },
        {
          date: 'Tuesday',
          temperature: 16,
          type: 'lowest'
        },
        {
          date: 'Wednesday',
          temperature: 17,
          type: 'lowest'
        },
        {
          date: 'Thursday',
          temperature: 18,
          type: 'lowest'
        },
        {
          date: 'Friday',
          temperature: 19,
          type: 'lowest'
        },
        {
          date: 'Saturday',
          temperature: 20,
          type: 'lowest'
        },
        {
          date: 'Sunday',
          temperature: 17,
          latest: true,
          type: 'lowest'
        },
        {
          date: 'Monday',
          temperature: 28,
          type: 'highest'
        },
        {
          date: 'Tuesday',
          temperature: 26,
          type: 'highest'
        },
        {
          date: 'Wednesday',
          temperature: 27,
          type: 'highest'
        },
        {
          date: 'Thursday',
          temperature: 28,
          type: 'highest'
        },
        {
          date: 'Friday',
          temperature: 29,
          type: 'highest'
        },
        {
          date: 'Saturday',
          temperature: 30,
          type: 'highest'
        },
        {
          date: 'Sunday',
          temperature: 27,
          latest: true,
          type: 'highest'
        }
      ]
    }
  ],
  xField: 'date',
  yField: 'temperature',
  seriesField: 'type',
  color: ['#016BFF', '#FF6666'],
  line: {
    style: {
      curveType: 'basis'
    }
  },
  point: {
    visible: false
  },
  axes: [
    { orient: 'left', title: { visible: true } },
    { orient: 'bottom', title: { visible: true } }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    title: {
      visible: true
    }
  },
  title: {
    visible: true,
    text: 'Weekly temperature change'
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[数据](link)

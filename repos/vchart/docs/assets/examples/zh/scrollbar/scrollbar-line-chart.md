---
category: examples
group: scrollBar
title: scrollBar 控制轴范围
keywords: scrollBar
order: 30-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/scrollbar-line-chart.png
option: lineChart#scrollbar
---

# scrollBar 控制轴范围

scrollBar 控制轴范围，通过设 `filterMode` 为 `axis`，只影响轴的范围，从而控制线的现实区域

## 关键配置

- `orient` 属性声明为字符串类型，用于设置 `scollBar` 的方位，可选值有: `bottom`, `right`
- `start` 属性声明为数值字段，取值范围为 `[0, 1]`
- `end` 属性声明为数值字段，取值范围为 `[0, 1]`，注意属性 `start` 的值要小于 `end` 的值
- `filterMode` 属性申明 `scrollBar` 控制数据显示范围的方式，可选值为: `axis`, `filter`；其中 `filterMode` 设置为 `filter` 的时候，表示多数据进行过滤，会影响轴的刻度计算；`filterMode` 设置为 `axis` 的时候，只是影响对应轴的坐标对应范围，不对数据进行过滤.
- `roam` 属性声明为 `Boolean`类型，用于设置是否开启缩放平移功能

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '0:05',
        value: 10
      },
      {
        time: '0:10',
        value: 18
      },
      {
        time: '0:15',
        value: 20
      },
      {
        time: '0:20',
        value: 18
      },
      {
        time: '0:25',
        value: 20
      },
      {
        time: '0:30',
        value: 18
      },
      {
        time: '0:35',
        value: 20
      },
      {
        time: '0:40',
        value: 18
      },
      {
        time: '0:45',
        value: 20
      },
      {
        time: '0:50',
        value: 18
      },
      {
        time: '0:55',
        value: 10
      },
      {
        time: '1:00',
        value: 28
      },
      {
        time: '1:05',
        value: 18
      },
      {
        time: '1:10',
        value: 14
      },
      {
        time: '1:15',
        value: 12
      },
      {
        time: '1:20',
        value: 9
      },
      {
        time: '1:25',
        value: 20
      },
      {
        time: '1:30',
        value: 3
      },
      {
        time: '1:35',
        value: 4
      },
      {
        time: '1:40',
        value: 5
      },
      {
        time: '1:45',
        value: 10
      },
      {
        time: '1:50',
        value: 16
      },
      {
        time: '1:55',
        value: 10
      },
      {
        time: '2:00',
        value: 8
      },
      {
        time: '2:05',
        value: 18
      },
      {
        time: '2:10',
        value: 14
      },
      {
        time: '2:15',
        value: 12
      },
      {
        time: '2:20',
        value: 9
      },
      {
        time: '2:25',
        value: 20
      },
      {
        time: '2:30',
        value: 3
      },
      {
        time: '2:35',
        value: 4
      },
      {
        time: '2:40',
        value: 5
      },
      {
        time: '2:45',
        value: 10
      },
      {
        time: '2:50',
        value: 16
      },
      {
        time: '2:55',
        value: 10
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  scrollBar: [
    {
      orient: 'bottom',
      start: 0.8,
      end: 1,
      roam: true,
      filterMode: 'axis'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)

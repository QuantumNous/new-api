---
category: examples
group: bar chart
title: 基础条形图
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/23e5d313c2c3a66d4ca806005.png
option: barChart
---

# 基础条形图

条形图是在柱状图的基础上，做了 x 轴和 y 轴的转置，在配置上和柱状图基本一致，只是 x 轴和 y 轴的配置需要对调，同时需要加上 `direction` 属性配置为 'horizontal'。

## 关键配置

- `direction` 属性配置为 'horizontal'
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ],
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

[柱状图](link)

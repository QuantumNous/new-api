---
category: examples
group: bar chart
title: 百分比堆叠条形图
keywords: barChart,comparison,distribution,rectangle,composition,proportion
order: 2-10
cover: /vchart/preview/stack-percentage-bar_1.10.0.png
option: barChart
---

# 百分比堆叠条形图

百分比堆叠条形图用于展示多个维度的数据占比情况。

## 关键配置

- `direction` 属性配置为 'horizontal'
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段
- `stackField` 属性声明为堆叠字段
- `stack` 属性堆叠模式
- `percent` 属性配置为 `true` 开启数值百分比计算

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  yField: 'State',
  xField: 'Population',
  seriesField: 'Age',
  direction: 'horizontal',
  stack: true,
  stackCornerRadius: 1000,
  percent: true,
  legends: {
    visible: true
  },
  axes: [
    {
      orient: 'top',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)

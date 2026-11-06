---
category: examples
group: histogram chart
title: 水平堆叠直方图
keywords: histogram,distribution,rectangle,composition
order: 3-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-stack-h.png
option: hitogramChart
---

# 水平堆叠直方图

## 关键配置

- `xField` 属性声明为频率统计左区间字段
- `x2Field` 属性声明为频率统计右区间字段
- `yField` 属性声明为频率数值字段
- `seriesField` 属性声明为分组字段
- `direction` 属性声明为图表方向字段, `horizontal`表示水平方向, `vertical`表示垂直方向

## 代码演示

```javascript livedemo
const spec = {
  color: ['#1ac7c2', '#ccf59a'],
  type: 'histogram',
  xField: 'people',
  yField: 'age0',
  y2Field: 'age1',
  seriesField: 'sex',
  direction: 'horizontal',
  legends: {},
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'A trellis bar chart showing the US population distribution of age groups and gender in 2000.',
    textStyle: {
      height: 50,
      lineWidth: 2,
      fill: '#333',
      fontSize: 18,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: datum => datum['sex']
      },
      content: [
        {
          key: datum => datum['age0'] + '～' + datum['age1'],
          value: datum => datum['people']
        }
      ]
    }
  },
  axes: [
    {
      orient: 'bottom',
      nice: false
    }
  ],
  data: [
    {
      name: 'data1',
      values: [
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9735380,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10552146,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10563233,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 10237419,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9731315,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9659493,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10205879,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11475182,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11320252,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 9925006,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8507934,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6459082,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5123399,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4453623,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 3792145,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 2912655,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 1902638,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 970357,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 336303,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9310714,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10069564,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10022524,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 9692669,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9324244,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9518507,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10119296,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11635647,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11488578,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 10261253,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8911133,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6921268,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5668961,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4804784,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 5184855,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 4355644,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 3221898,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 1981156,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 1064581,
          sex: 'Male'
        }
      ]
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

---
title: 4. 如何对数据指定字段进行排序</br>
---
## 问题标题

如何对数据指定字段进行排序</br>


## 问题描述

## 对于下面这个折线图，时间排序只能在外部排吗？

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QHuIbiPwUoDv09x2RCYc4e3Nneg.gif' alt='' width='1554' height='1098'>



## 解决方案 

数据配置的时候可以根据字段进行排序，字段类型分为离散类型和连续类型，需要根据字段类型配置排序以及排序顺序</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VITRbqgDyox6ekxn8jQcjenWnMe.gif' alt='' width='2850' height='1328'>

## 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      { date: '2023-01-01', type: 'Product A', value: 99.9 },
      { date: '2023-01-02', type: 'Product C', value: 93.4 },
      { date: '2023-01-01', type: 'Product B', value: 96.6 },
      { date: '2023-01-02', type: 'Product A', value: 96.7 },
      { date: '2023-01-02', type: 'Product B', value: 91.1 },
      { date: '2023-01-03', type: 'Product A', value: 100.2 },
      { date: '2023-01-03', type: 'Product B', value: 99.4 },
      { date: '2023-01-03', type: 'Product C', value: 91.7 },
      { date: '2023-01-04', type: 'Product A', value: 104.7 },
      { date: '2023-01-05', type: 'Product B', value: 96 },
      { date: '2023-01-05', type: 'Product C', value: 92.3 },
      { date: '2023-01-06', type: 'Product A', value: 95.6 },
      { date: '2023-01-06', type: 'Product B', value: 89.1 },
      { date: '2023-01-09', type: 'Product B', value: 100.6},
      { date: '2023-01-09', type: 'Product C', value: 103.8},
      { date: '2023-01-04', type: 'Product C', value: 93.1 },
      { date: '2023-01-04', type: 'Product B', value: 108.1 },
      { date: '2023-01-07', type: 'Product A', value: 95.3 },
      { date: '2023-01-07', type: 'Product B', value: 89.2 },
      { date: '2023-01-07', type: 'Product C', value: 95.7 },
      { date: '2023-01-08', type: 'Product A', value: 96.1 },
      { date: '2023-01-08', type: 'Product B', value: 97.6 },
      { date: '2023-01-09', type: 'Product A', value: 96.1 },
      { date: '2023-01-10', type: 'Product A', value: 101.6 },
      { date: '2023-01-10', type: 'Product B', value: 108.3 },
      { date: '2023-01-10', type: 'Product C', value: 108.9 }
    ],
    fields: {
      date: {
        type: 'ordinal', // 数据维度 date 的类型是离散类型
        sortIndex: 1 // 数据会按照 date 进行排序
      },
    }
  },
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  point: {
    visible: false
  },
  line: {
    style: {
      lineWidth: 2
    }
  },
  legends: { visible: true },
  axes: [
    {
      orient: 'bottom',
      // paddingInner: 1,
      // paddingOuter: 0,
      trimPadding: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FYI1byDssoXjUwxXKfxcsbDdn1f.gif' alt='' width='1450' height='1046'>



## Related documents

  Related configuration: https://www.visactor.io/vchart/option/barChart*#data(IDataType%7CIDataType%5B%5D).IDataValues.fields*</br>
  GitHub: https://github.com/VisActor/VChart</br>


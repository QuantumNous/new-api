---
title: How to sort data by specified fields?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## *Question Description*



For the line chart below, can the time sorting only be done externally?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RYUsbn3kvoY6yNxUFAPcVef3nCg.gif' alt='' width='1280' height='904'>



## *Solution*



When configuring the data, sorting can be done based on fields. Field types are divided into discrete types and continuous types, and sorting order needs to be configured based on field types.</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WZJUbgg8DotvA3xQMncc25Vmn5c.gif' alt='' width='1280' height='596'>

## *Code Example*

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


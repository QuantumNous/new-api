---
title: 91. 连续轴的刻度范围可以通过配置尽量的贴近数据范围吗</br>
---
## 问题标题

连续轴的刻度范围可以通过配置尽量的贴近数据范围吗</br>
## 问题描述

下面的线图中，连续轴的刻度范围比实际数据的范围大比较多，可以通过配置，让刻度的范围更加接近数据的范围吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WyuibTs0BoP3LZxSNrdccbrvn5b.gif' alt='' width='1496' height='1040'>

## 解决方案

连续轴的刻度算法是根据一些列规则计算而来的，其中轴刻度范围和实际数据的范围也是衡量指标之一，如果还需要进一步优化轴刻度的范围，有两个优化点：</br>
*  刻度可以通过`zero: false`调整为不强制从0开始</br>
*  刻度算法可以考虑切换成d3的算法，d3刻度算法在保证数据范围上更好</br>
```
axes: [{
    orient: 'left',
    tick: {
      tickMode: 'd3'
    },
    zero: false
  }]</br>
```


## 代码示例 

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
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
  axes: [{
    orient: 'left',
    tick: {
      tickMode: 'd3'
    },
    zero: false
  }]
};</br>
```
## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/G4jMbhVskoZpKAxqQNzcG8etnnC.gif' alt='' width='1486' height='1066'>

## 相关文档

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [轴配置文档](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart-axes-linear%23tick.tickMode('average'%257C'd3')%2520%3D%2520'average')</br>
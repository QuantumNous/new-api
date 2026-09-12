---
title: Can the graduated range of a continuous shaft be adjusted as close to the data range as possible?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question Title

Can the graduated range of a continuous shaft be adjusted as close to the data range as possible?</br>
## Problem Description

In the following line graph, the scale range of the continuous axis is much larger than the actual data range. Can it be configured to make the scale range closer to the data range?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WNqGbg5khomL46xBvzjcxKwQn7b.gif' alt='' width='1496' height='1040'>

## Solution

The continuous axis tick algorithm is calculated based on a series of rules, where the axis tick range and the actual data range are also indicators. If you need to further optimize the axis tick range, there are two optimization points:</br>
*  The tick can be adjusted not to be forced to start from 0 by using `zero: false`</br>
*  The tick algorithm can be considered to switch to the d3 algorithm. The d3 tick algorithm is better in ensuring data range.</br>
```
axes: [{
    orient: 'left',
    tick: {
      tickMode: 'd3'
    },
    zero: false
  }]</br>
```


## Code Examples

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
## Result Presentation

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/R1hRblX1CoJ1f4xKm4XcaMgQnPe.gif' alt='' width='1486' height='1066'>

## Related documents

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [Axis configuration document](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart-axes-linear%23tick.tickMode('average'%257C'd3')%2520%3D%2520'average')</br>
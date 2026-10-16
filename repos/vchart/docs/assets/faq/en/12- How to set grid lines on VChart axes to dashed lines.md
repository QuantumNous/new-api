---
title: 38. How to set VChart axis gridlines as dashed lines？</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set VChart axis gridlines as dashed lines？</br>


## Problem Description

How to set the grid lines of the coordinate axis in VChart as dashed lines and adjust the style of the dashed lines?</br>


## Solution

In VChart, the configuration item for axis gridline style is `axes[i].grid.style `. You can adjust the solid line to the dashed line effect you want by configuring the `lineDash`property.</br>
`lineDash `uses a set of values to specify the alternating length of lines and gaps that describe the pattern. For example:</br>
```
lineDash: [2, 3]; 
lineDash: [0]; // solid line</br>
```
## Code Example

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
  axes:[
    {
      orient:'left',
      grid:{
        style:{
          stroke:"black",
          lineDash:[5,5]
        }
      }
    },
    {
      orient:'bottom',
      grid:{
        visible: true,
        style:{
          stroke:"black",
          lineDash:[5,5]
        }
      }
    }
  ],
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SxWmbYou1olBNVx1DjscTW2unYI.gif' alt='' width='1280' height='796'>



## Quote

*  [lineDash Configuration Items](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-extensionMark-symbol%23style.lineDash(number%5B%5D))</br>
*  [Axis Tutorial](https%3A%2F%2Fvisactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)</br>
*  github：https://github.com/VisActor/VChart</br>


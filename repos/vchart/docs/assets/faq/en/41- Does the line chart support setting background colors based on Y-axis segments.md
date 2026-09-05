---
title: Can a line chart set different background colors for each section along the y-axis?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
Can a line chart set different background colors for each section along the y-axis?</br>
## Problem Description

In the following line chart, is it possible to set background colors for each section along the y-axis?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VWGZbRM14oC1mOxSGn2cyOJSnUe.gif' alt='' width='1496' height='1040'>

## Solution

There are two ways you can achieve this background color request.</br>
*  Solution 1: You can set the grid fill color by configuring `axes.grid.alternateColor`:</br>
```
axes: [
    {
      orient: 'left',
      grid: {
        alternateColor: [
          'rgba(0, 255, 0, 0.3)', 
          'rgba(255, 0, 0, 0.2)',
          'rgba(0, 0, 255, 0.2)'
          ]
      }
    }
  ]</br>
```
*  Solution 2: VChart supports a variety of annotation components, among which `markArea` can be used to configure annotation blocks. Therefore, we can configure the background color blocks in the following way</br>
```
markArea: [
    {
      y: 0,
      y1: 5,
      area: {
        style: {
          fill: 'red',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 5,
      y1: 10,
      area: {
        style: {
          fill: 'yellow',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 10,
      y1: 15,
      area: {
        style: {
          fill: 'pink',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 15,
      y1: 20,
      area: {
        style: {
          fill: 'green',
          fillOpacity: 0.2
        }
      }
    },
   ]</br>
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
  markArea: [
    {
      y: 0,
      y1: 5,
      area: {
        style: {
          fill: 'red',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 5,
      y1: 10,
      area: {
        style: {
          fill: 'yellow',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 10,
      y1: 15,
      area: {
        style: {
          fill: 'pink',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 15,
      y1: 20,
      area: {
        style: {
          fill: 'green',
          fillOpacity: 0.2
        }
      }
    },
   ]
};</br>
```
## Results Show



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AJaHbsUkJoK4QVxVJuWcfHmGnvf.gif' alt='' width='1474' height='1070'>

## Related Documents

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [Marker Data Labeling Tutorial](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2Fmarker)</br>
*  [MarkArea Configuration Document](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart%23markArea)</br>
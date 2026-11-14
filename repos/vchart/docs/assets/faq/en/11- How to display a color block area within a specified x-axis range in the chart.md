---
title: How to display a color block area in a chart that covers the specified x-axis range?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to display a color block area in a chart that covers a specified x-axis range?</br>


## Problem description

Similar to the effect shown in the figure below, I hope to draw a color block within the specified x-axis range in the chart. How should I configure it in VChart?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EibXbzwJOoFAVpx2aJ8czy9rnbe.gif' alt='' width='1108' height='488'>

## Solution

You can achieve this through the `markArea `component, using the `markArea.coordinates `property to declare the range of data to be annotated.</br>
*  `Coordinates `: Support configuring data values, VChart will automatically map the data to canvas coordinates for range drawing.</br>
```
  markArea: [
    {
      coordinates: [
        {
          Date: 'Jan-20',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.12
        },
        {
          Date: 'Jan-20',
          Price: 0.12
        }
      ],
      label: {
        text: 'Electricite prices have surged since 2020',
        position: 'insideTop'
      }
    }
  ],</br>
```


## Code example

https://visactor.io/vchart/demo/marker/mark-area-basic</br>


## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EHkDbYUoMoaJjNxQAndcjuxbnCf.gif' alt='' width='1671' height='1044'>

## Related Documents

*  github：https://github.com/VisActor/VChart</br>
*  MarkArea demo: https://visactor.io/vchart/demo/marker/mark-area-basic</br>
*  MarkArea tutorial: https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/marker</br>


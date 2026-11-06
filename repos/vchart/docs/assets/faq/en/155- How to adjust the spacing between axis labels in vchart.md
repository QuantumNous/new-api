---
title: How to adjust spacing between axis labels in vchart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to adjust spacing between axis labels in vchart?</br>
## Problem Description

When I used vchart to draw a histogram, I found that the spacing between the axis labels was too small, causing the labels to overlap and make it difficult to read. Is there any way to adjust the spacing between axis labels? Can the minGap configuration be configured to set this label spacing?</br>
## Solution

The configuration item minGap is used to determine the minimum distance between labels in the axis label sampling calculation.</br>
Now the position of the axis label is associated with the corresponding column position mapping, and the position of the label cannot be configured separately. If you want to adjust the space between axis labels, you can affect the spacing between axis labels by adjusting the paddingOuter property of the scale corresponding to the axis. paddingOuter represents the space occupied by both ends of the axis. Reducing paddingOuter leaves more layout space for labels.</br>
```
  axes: [
    { orient: 'bottom', paddingOuter: 0 }
  ]</br>
```
## Code Example

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  axes: [
    { orient: 'bottom', paddingOuter: 0 }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Uz58b1FMgolqHkxEml3c0Bvunse.gif' alt='' width='1670' height='1046'>



## Quote

*  Github: https://github.com/VisActor/VChart</br>
*  Spec: https://visactor.bytedance.net/vchart/option/barChart-axes-band#paddingOuter(number%7Cnumber%5B%5D)</br>

